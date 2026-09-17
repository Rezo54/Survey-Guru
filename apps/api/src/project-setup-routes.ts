import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { verifyRequestIdentity } from './auth.js';
import { requirePermission, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
import { ProjectSetupValidationError, validateProjectAssignment, validateProjectSetup } from './project-setup.js';
import { buildOverpassRoadQuery, projectStreetSegmentsFromOverpass, type OverpassResponse } from './osm-street-geometry.js';
import { parseOptionalBoundary } from './street-coverage-data.js';

type ProjectSetupBody = { name?: unknown; areaName?: unknown; boundary?: unknown; timeZone?: unknown; formTemplateId?: unknown; questions?: unknown };
type ProjectAssignmentBody = { userId?: unknown; areaName?: unknown };

export class ProjectSetupRequestError extends Error {
  statusCode = 400;
}

export function registerProjectSetupRoutes(app: FastifyInstance): void {
  app.post<{ Params: { projectId: string } }>('/api/v1/dev/projects/:projectId/import-streets', async (request) => {
    if ((process.env.SURVEY_GURU_ENV ?? 'local') !== 'dev') throw new ProjectSetupRequestError('The test street importer is available only in development.');
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'workspace.admin');
    const { firestore } = getFirebaseAdminServices();
    const project = await firestore.collection('projects').doc(request.params.projectId).get();
    if (!project.exists || project.get('workspaceId') !== authority.workspaceId || project.get('environment') !== 'dev') throw new ProjectSetupRequestError('Select a development project in your workspace.');
    const boundary = parseOptionalBoundary(project.get('boundary'));
    if (boundary.length < 3) throw new ProjectSetupRequestError('The project has no valid published polygon.');
    const endpoint = process.env.OVERPASS_API_URL ?? 'https://overpass-api.de/api/interpreter';
    const maximumSegments = Number(process.env.SURVEY_GURU_MAX_DEV_STREET_SEGMENTS ?? 10_000);
    if (!endpoint.startsWith('https://')) throw new ProjectSetupRequestError('The configured road provider must use HTTPS.');
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': 'Survey-Guru-development-road-import/1.0' }, body: new URLSearchParams({ data: buildOverpassRoadQuery(boundary) }), signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new ProjectSetupRequestError(`The road provider returned HTTP ${response.status}.`);
    const segments = projectStreetSegmentsFromOverpass({ response: await response.json() as OverpassResponse, workspaceId: authority.workspaceId, projectId: project.id, boundary });
    if (segments.length === 0) throw new ProjectSetupRequestError('No eligible streets were found inside this polygon.');
    if (segments.length > maximumSegments) throw new ProjectSetupRequestError(`The polygon contains ${segments.length} street segments, above the ${maximumSegments} development limit. Draw a smaller area or raise SURVEY_GURU_MAX_DEV_STREET_SEGMENTS.`);
    const importedAt = new Date().toISOString();
    for (let start = 0; start < segments.length; start += 350) {
      const batch = firestore.batch();
      for (const segment of segments.slice(start, start + 350)) {
        const { id, ...data } = segment;
        batch.set(firestore.collection('projectStreetSegments').doc(id), { ...data, geometryQuality: 'AUTHORITATIVE_EXTERNAL', attribution: '© OpenStreetMap contributors', licence: 'ODbL-1.0', importedAt, environment: 'dev', verificationStatus: 'UNVERIFIED' }, { merge: true });
      }
      await batch.commit();
    }
    await firestore.collection('streetGeometryImports').add({ workspaceId: authority.workspaceId, projectId: project.id, provider: 'openstreetmap', segmentCount: segments.length, importedAt, boundaryVersion: project.get('boundaryVersion') ?? null, environment: 'dev', importedBy: identity.uid });
    return { projectId: project.id, segmentCount: segments.length, initialCoverageState: 'NOT_WALKED', message: `${segments.length} polygon-scoped streets imported. All begin as not walked.` };
  });

  app.get('/api/v1/admin/project-assignment-options', async (request) => {
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'workspace.admin');
    const { firestore, auth } = getFirebaseAdminServices();
    const [projectsSnapshot, membershipsSnapshot, firebaseUsers] = await Promise.all([
      firestore.collection('projects').where('workspaceId', '==', authority.workspaceId).where('status', '==', 'active').get(),
      firestore.collection('workspaceMemberships').where('workspaceId', '==', authority.workspaceId).where('status', '==', 'active').get(),
      auth.listUsers(1000),
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
    const memberUserIds = new Set(membershipsSnapshot.docs.map((membership) => membership.get('userId')).filter((value): value is string => typeof value === 'string'));
    const newFirebaseUsers = firebaseUsers.users
      .filter((user) => user.uid !== identity.uid && !user.disabled && Boolean(user.email) && !memberUserIds.has(user.uid))
      .map((user) => ({ id: user.uid, email: user.email ?? user.uid, roleKey: 'field_worker', roleName: 'New Firebase user · activate as Field Worker' }));
    return {
      projects: projectsSnapshot.docs.map((project) => ({ id: project.id, name: project.get('name'), boundaryAreaSquareKm: project.get('boundaryAreaSquareKm') ?? null, publishedAt: project.get('publishedAt') ?? null })),
      capturers: [...capturers, ...newFirebaseUsers].sort((left, right) => left.email.localeCompare(right.email)),
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
    const { firestore, auth } = getFirebaseAdminServices();
    const project = await firestore.collection('projects').doc(request.params.projectId).get();
    if (!project.exists || project.get('workspaceId') !== authority.workspaceId || project.get('status') !== 'active') throw new ProjectSetupRequestError('Select an active project in your workspace.');
    const membershipSnapshot = await firestore.collection('workspaceMemberships').where('workspaceId', '==', authority.workspaceId).where('userId', '==', assignmentInput.userId).where('status', '==', 'active').limit(1).get();
    const membership = membershipSnapshot.docs[0];
    if (!membership) {
      let firebaseUser;
      try { firebaseUser = await auth.getUser(assignmentInput.userId); }
      catch { throw new ProjectSetupRequestError('The selected Firebase account does not exist.'); }
      if (firebaseUser.disabled || !firebaseUser.email) throw new ProjectSetupRequestError('The selected Firebase account is disabled or has no email address.');
      const now = new Date().toISOString();
      const activation = firestore.batch();
      activation.set(firestore.collection('users').doc(firebaseUser.uid), { firebaseUid: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName ?? null, status: 'active', environment: 'dev', updatedAt: now }, { merge: true });
      activation.set(firestore.collection('roleDefinitions').doc('field_worker'), { name: 'Field Worker', scope: 'workspace-project-assignment', permissions: ['project.read', 'assignment.read', 'field.capture', 'coverage.read'], environment: 'dev' }, { merge: true });
      activation.set(firestore.collection('workspaceMemberships').doc(`wsm_${firebaseUser.uid}`), { userId: firebaseUser.uid, workspaceId: authority.workspaceId, roleKey: 'field_worker', status: 'active', environment: 'dev', activatedAt: now, activatedBy: identity.uid }, { merge: true });
      await activation.commit();
    }
    const activeMembership = membership ?? await firestore.collection('workspaceMemberships').doc(`wsm_${assignmentInput.userId}`).get();
    const [user, role] = await Promise.all([
      firestore.collection('users').doc(assignmentInput.userId).get(),
      firestore.collection('roleDefinitions').doc(String(activeMembership.get('roleKey'))).get(),
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
      timeZone: setup.timeZone,
      storeCaptureForm: { templateId: setup.formTemplateId, version: 1, questions: setup.questions },
      storeCaptureRequiredQuestionIds: [...(setup.formTemplateId === 'STANDARD_FMCG' ? ['ownerName', 'brandProducts'] : []), ...setup.questions.filter((question) => question.required).map((question) => question.id)],
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
      project: { id: projectId, name: setup.name, status: 'active', boundaryAreaSquareKm: setup.areaSquareKm, timeZone: setup.timeZone, formTemplateId: setup.formTemplateId },
      assignment: { id: assignmentId, areaName: setup.areaName, assignedUserId: identity.uid },
      searchSession: { id: searchSessionId, state: 'READY' },
      links: { fieldMap: `/field/map?session=${encodeURIComponent(searchSessionId)}`, projectMap: `/projects/demo/map?project=${encodeURIComponent(projectId)}` },
    };
  });
}
