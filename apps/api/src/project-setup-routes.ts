import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { verifyRequestIdentity } from './auth.js';
import { requirePermission, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
import { ProjectSetupValidationError, validateProjectSetup } from './project-setup.js';

type ProjectSetupBody = { name?: unknown; areaName?: unknown; boundary?: unknown };

export class ProjectSetupRequestError extends Error {
  statusCode = 400;
}

export function registerProjectSetupRoutes(app: FastifyInstance): void {
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
