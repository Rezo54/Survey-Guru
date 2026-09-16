import type { FastifyInstance } from 'fastify';
import { verifyRequestIdentity } from './auth.js';
import { AuthorisationError, requirePermission, requireProjectScope, resolveAuthority } from './authority.js';
import { resolveCoveragePolicy } from './coverage-policy.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
import { parseCoverageContribution, parseOptionalBoundary, parseProjectStreetSegment } from './street-coverage-data.js';
import {
  buildProjectStreetCoverageView,
  type MapMatchPolicy,
} from './map-matching.js';

export function registerStreetCoverageRoutes(app: FastifyInstance): void {
  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/street-coverage', async (request) => {
    const identity = await verifyRequestIdentity(request);
    const authority = await resolveAuthority(identity);
    requirePermission(authority, 'coverage.read');
    requireProjectScope(authority, request.params.projectId);

    const { firestore } = getFirebaseAdminServices();
    const project = await firestore.collection('projects').doc(request.params.projectId).get();
    if (!project.exists || project.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Project is outside the authorised scope.');
    const coveragePolicy = await resolveCoveragePolicy(firestore, { coveragePolicyId: project.get('coveragePolicyId'), workspaceId: authority.workspaceId, projectId: project.id });
    const policy: MapMatchPolicy = {
      maximumLateralDistanceMetres: coveragePolicy.maximumMapMatchDistanceMetres,
      maximumHeadingDeltaDegrees: coveragePolicy.maximumHeadingDeltaDegrees,
      minimumContinuityScore: coveragePolicy.minimumContinuityScore,
      ambiguityScoreGap: coveragePolicy.ambiguityScoreGap,
      partialTraversalPercent: coveragePolicy.partialTraversalPercent,
      coveredTraversalPercent: coveragePolicy.coveredTraversalPercent,
      algorithmVersion: coveragePolicy.algorithmVersion,
      coveragePolicyVersion: coveragePolicy.version,
    };

    const [segmentSnapshot, contributionSnapshot] = await Promise.all([
      firestore.collection('projectStreetSegments').where('projectId', '==', project.id).get(),
      firestore.collection('streetCoverageContributions').where('projectId', '==', project.id).get(),
    ]);
    const contributions = contributionSnapshot.docs
      .filter((document) => document.get('workspaceId') === authority.workspaceId && document.get('status') === 'ACCEPTED')
      .map((document) => parseCoverageContribution(document.id, document.data()));
    const streetSegments = segmentSnapshot.docs.filter((document) => document.get('workspaceId') === authority.workspaceId && document.get('eligible') === true).map((document) => {
      const segment = parseProjectStreetSegment(document.id, document.data());
      return buildProjectStreetCoverageView({ segment, contributions, policy, verified: document.get('verificationStatus') === 'VERIFIED' });
    });

    return {
      projectId: project.id,
      ownership: 'PROJECT_SHARED',
      projectBoundary: parseOptionalBoundary(project.get('boundary')),
      streetSegments,
      summary: {
        totalSegments: streetSegments.length,
        uncoveredSegments: streetSegments.filter((segment) => segment.coverageState === 'UNCOVERED').length,
        partialSegments: streetSegments.filter((segment) => segment.coverageState === 'PARTIALLY_COVERED').length,
        coveredSegments: streetSegments.filter((segment) => segment.coverageState === 'COVERED' || segment.coverageState === 'VERIFIED').length,
      },
      authority: { permission: 'coverage.read', workspaceId: authority.workspaceId, projectScoped: true, identityScoped: false },
    };
  });
}
