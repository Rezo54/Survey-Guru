import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { verifyRequestIdentity } from './auth.js';
import { requirePermission, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
import { ProjectSetupValidationError, validateProjectAssignment, validateProjectSetup } from './project-setup.js';

type ProjectSetupBody = { name?: unknown; areaName?: unknown; boundary?: unknown };
type ProjectAssignmentBody = { userId?: unknown; areaName?: unknown };

export class ProjectSetupRequestError extends Error {
  statusCode = 400;
}

export function registerProjectSetupRoutes(app: FastifyInstance): void {
  app.get('/api/v1/admin/project-assignment-options', async (request) => {
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'workspace.admin');
    const { firestore } = getFirebaseAdminServices();
    const [projectsSnapshot, membershipsSnapshot] = await Promise.all([
      firestore.collection('projects').where('workspaceId', '==', authority.workspaceId).where('status', '==', 'active').get(),
      firestore.collection('workspaceMemberships').where('workspaceId', '==', authority.workspaceId).where('status', '==', 'active').get(),
    ]);
    const capturers = (await Promise.all(membershipsSnapshot.docs.map(async (membership) => {
      const userId = membership.get('userId');
      const roleKey = membership.get('roleKey');
      if (typeof userId !== 'string' || typeof roleKey !== 'string') return null;
      const [user, role] = await Promise.all([
        firestore.collection('users').doc(userId).get(),
        firestore.collection('roleDefinitions').doc(roleKey).get(),
      ]);
      const permissions = role.get('permissions');
      if (!user.exists || user.get('status') !== 'active' || !Array.isArray(permissions) || !permissions.includes('field.capture') || permissions.includes('workspace.admin')) return null;
      return { id: userId, email: user.get('email') ?? userId, roleKey, roleName: role.get('name') ?? roleKey };
    }))).filter((capturer): capturer is { id: string; email: string; roleKey: string; roleName: string } => capturer !== null);
    return {
      projects: projectsSnapshot.docs.map((project) => ({ id: project.id, name: project.get('name'), boundaryAreaSquareKm: project.get('boundaryAreaSquareKm') ?? null, publishedAt: project.get('publishedAt') ?? null })),
      capturers,
    };
  });

  app.post<{ Params: { projectId: string }; Body: ProjectAssignmentBody }>('/api/v1/admin/projects/:projectId/assign', async (request) => {
    if ((process.env.SURVEY_GURU_ENV ?? 'local') !== 'dev') throw new ProjectSetupRequestError('The test-project assignment endpoint is available only in development.');
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'workspace.admin');
    let assignmentInput;
    try {
      assignmentInput = validateProjectAssignment(request.body ?? {});
    } catch (error) {
      if (error instanceof ProjectSetupValidationError) throw new ProjectSetupRequestError(error.message);
      throw error;
    }
    const { firestore } = getFirebaseAdminServices();
    const project = await firestore.collection('projects').doc(request.params.projectId).get();
    if (!project.exists || project.get('workspaceId') !== authority.workspaceId || project.get('status') !== 'active') throw new ProjectSetupRequestError('Select an active project in your workspace.');
    const membershipSnapshot = await firestore.collection('workspaceMemberships').where('workspaceId', '==', authority.workspaceId).where('userId', '==', assignmentInput.userId).where('status', '==', 'active').limit(1).get();
    const membership = membershipSnapshot.docs[0];
    if (!membership) throw new ProjectSetupRequestError('The selected capturer is not an active workspace member.');
    const [user, role] = await Promise.all([
      firestore.collection('users').doc(assignmentInput.userId).get(),
      firestore.collection('roleDefinitions').doc(String(membership.get('roleKey'))).get(),
    ]);
    const permissions = role.get('permissions');
    if (!user.exists || user.get('status') !== 'active' || !Array.isArray(permissions) || !permissions.includes('field.capture') || permissions.includes('workspace.admin')) throw new ProjectSetupRequestError('The selected account is not an eligible field capturer.');

    const safeUserId = assignmentInput.userId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
    const assignmentId = `asg_${request.params.projectId}_${safeUserId}`;
    const sessionId = `ss_${assignmentId}`;
    const coveragePolicyId = project.get('coveragePolicyId');
    const now = new Date().toISOString();
    const batch = firestore.batch();
    batch.set(firestore.collection('projectMemberships').doc(`prjm_${request.params.projectId}_${assignmentInput.userId}`), {
      userId: assignmentInput.userId, workspaceId: authority.workspaceId, projectId: request.params.projectId, status: 'active', environment: 'dev', assignedAt: now, assignedBy: identity.uid,
    }, { merge: true });
    batch.set(firestore.collection('assignments').doc(assignmentId), {
      workspaceId: authority.workspaceId, projectId: request.params.projectId, assignedUserId: assignmentInput.userId,
      teamId: `team_${safeUserId}`, teamName: user.get('email') ?? 'Field capturer', areaName: assignmentInput.areaName,
      assignmentType: 'coverage_search', status: 'active', priority: 'priority', evidenceState: 'unknown', targetState: 'searched',
      scheduledWindow: 'Assigned by project administrator', outstandingKm: 0, coveragePolicyId, environment: 'dev', assignedAt: now, assignedBy: identity.uid,
    }, { merge: true });
    const existingSession = await firestore.collection('searchSessions').doc(sessionId).get();
    if (!existingSession.exists) batch.create(firestore.collection('searchSessions').doc(sessionId), {
      workspaceId: authority.workspaceId, projectId: request.params.projectId, assignmentId, userId: assignmentInput.userId,
      teamId: `team_${safeUserId}`, areaName: assignmentInput.areaName, state: 'READY', coverageState: 'UNCOVERED', searchedKm: 0, partialKm: 0, unknownKm: 0,
      queuedEvidenceCount: 0, acceptedEvidenceCount: 0, rejectedEvidenceCount: 0, coveragePolicyId, coveragePolicyVersion: 1, environment: 'dev', updatedAt: now,
    });
    else batch.update(existingSession.ref, { areaName: assignmentInput.areaName, updatedAt: now });
    await batch.commit();
    return {
      project: { id: project.id, name: project.get('name') },
      capturer: { id: assignmentInput.userId, email: user.get('email') },
      assignment: { id: assignmentId, areaName: assignmentInput.areaName, status: 'active' },
      searchSession: { id: sessionId, state: existingSession.get('state') ?? 'READY' },
      links: { fieldMap: `/field/map?session=${encodeURIComponent(sessionId)}` },
    };
  });

  app.post<{ Body: ProjectSetupBody }>('/api/v1/dev/projects/publish', async (request) => {
    if ((process.env.SURVEY_GURU_ENV ?? 'local') !== 'dev') throw new ProjectSetupRequestError('The test-project publisher is available only in the development environment.');
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'workspace.admin');

    let setup;
    try {
      setup = validateProjectSetup(request.body ?? {});
    } catch (error) {
      if (error instanceof ProjectSetupValidationError) throw new ProjectSetupRequestError(error.message);
      throw error;
    }

    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const projectId = `prj_${suffix}`;
    const coveragePolicyId = `cp_${suffix}_v1`;
    const assignmentId = `asg_${suffix}`;
    const searchSessionId = `ss_${assignmentId}`;
    const now = new Date().toISOString();
    const { firestore } = getFirebaseAdminServices();
    const batch = firestore.batch();

    batch.create(firestore.collection('coveragePolicies').doc(coveragePolicyId), {
      workspaceId: authority.workspaceId, projectId, mode: 'EXHAUSTIVE_STREET', version: 1, status: 'pilot',
      movementModesAllowed: ['walking'], minimumGpsAccuracyRule: { maximumMetres: 100 }, continuityRule: { maximumGapSeconds: 600 },
      mapMatching: { maximumLateralDistanceMetres: 25, maximumHeadingDeltaDegrees: 40, minimumContinuityScore: 0.65, ambiguityScoreGap: 0.12 },
      thresholds: { partialTraversalPercent: 25, coveredTraversalPercent: 85 }, verificationRequired: true,
      algorithmVersion: 'map-match-dev-v1', environment: 'dev', createdAt: now,
    });
    batch.create(firestore.collection('projects').doc(projectId), {
      workspaceId: authority.workspaceId, name: setup.name, status: 'active', environment: 'dev', coveragePolicyId,
      storeCaptureRequiredQuestionIds: ['ownerName', 'stockedBrands', 'pricing'],
      storeQaPolicy: { mode: 'EXCEPTION_ONLY', autoVerifyEnabled: true, manualApprovalBeforeExport: false, maximumGpsAccuracyMetres: 30, minimumPhotoCount: 1, policyVersion: 'store-qa-dev-v1' },
      boundary: setup.boundary, boundaryVersion: `dev-${suffix}`, boundaryAreaSquareKm: setup.areaSquareKm,
      summary: { searchedPercent: 0, outstandingKm: 0, verifiedPriorityOutlets: 0, networkDecision: 'not-yet' },
      publishedAt: now, publishedBy: identity.uid,
    });
    batch.create(firestore.collection('projectMemberships').doc(`prjm_${projectId}_${identity.uid}`), {
      userId: identity.uid, workspaceId: authority.workspaceId, projectId, status: 'active', environment: 'dev', createdAt: now,
    });
    batch.create(firestore.collection('assignments').doc(assignmentId), {
      workspaceId: authority.workspaceId, projectId, assignedUserId: identity.uid, teamId: `team_${suffix}`, teamName: 'Project setup test',
      areaName: setup.areaName, assignmentType: 'coverage_search', status: 'active', priority: 'priority', evidenceState: 'unknown', targetState: 'searched',
      scheduledWindow: 'Test capture', outstandingKm: 0, coveragePolicyId, environment: 'dev', createdAt: now,
    });
    batch.create(firestore.collection('searchSessions').doc(searchSessionId), {
      workspaceId: authority.workspaceId, projectId, assignmentId, userId: identity.uid, teamId: `team_${suffix}`, areaName: setup.areaName,
      state: 'READY', coverageState: 'UNCOVERED', searchedKm: 0, partialKm: 0, unknownKm: 0, queuedEvidenceCount: 0,
      acceptedEvidenceCount: 0, rejectedEvidenceCount: 0, coveragePolicyId, coveragePolicyVersion: 1, environment: 'dev', updatedAt: now,
    });
    await batch.commit();

    return {
      project: { id: projectId, name: setup.name, status: 'active', boundaryAreaSquareKm: setup.areaSquareKm },
      assignment: { id: assignmentId, areaName: setup.areaName, assignedUserId: identity.uid },
      searchSession: { id: searchSessionId, state: 'READY' },
      links: { fieldMap: `/field/map?session=${encodeURIComponent(searchSessionId)}`, projectMap: `/projects/${encodeURIComponent(projectId)}/map` },
    };
  });
}
