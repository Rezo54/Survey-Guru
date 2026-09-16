import type { FastifyInstance } from 'fastify';
import { verifyRequestIdentity } from './auth.js';
import { AuthorisationError, requirePermission, requireProjectScope, resolveAuthority } from './authority.js';
import { resolveCoveragePolicy } from './coverage-policy.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
import {
  buildProjectStreetCoverageView,
  type Coordinate,
  type CoverageContribution,
  type MapMatchPolicy,
  type ProjectStreetSegment,
} from './map-matching.js';

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function coordinates(value: unknown): readonly Coordinate[] {
  if (!Array.isArray(value)) throw new Error('Project street geometry is invalid.');
  const result = value.map((point) => {
    if (!point || typeof point !== 'object') throw new Error('Project street geometry is invalid.');
    const latitude = Reflect.get(point, 'latitude');
    const longitude = Reflect.get(point, 'longitude');
    if (!finite(latitude) || !finite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error('Project street geometry is invalid.');
    return { latitude, longitude };
  });
  if (result.length < 2) throw new Error('Project street geometry requires at least two coordinates.');
  return result;
}

function projectStreetSegment(id: string, data: Record<string, unknown>): ProjectStreetSegment {
  const { workspaceId, projectId, streetSegmentId, lengthMetres, geometry, source } = data;
  if (typeof workspaceId !== 'string' || typeof projectId !== 'string' || typeof streetSegmentId !== 'string' || !finite(lengthMetres) || lengthMetres <= 0 || !source || typeof source !== 'object') throw new Error('Project street segment is invalid.');
  const provider = Reflect.get(source, 'provider');
  const sourceId = Reflect.get(source, 'sourceId');
  const sourceVersion = Reflect.get(source, 'sourceVersion');
  if (typeof provider !== 'string' || typeof sourceId !== 'string' || typeof sourceVersion !== 'string') throw new Error('Project street source provenance is invalid.');
  return { id, workspaceId, projectId, streetSegmentId, lengthMetres, geometry: coordinates(geometry), eligible: data.eligible === true, source: { provider, sourceId, sourceVersion } };
}

function contribution(id: string, data: Record<string, unknown>): CoverageContribution {
  const requiredStrings = ['projectId', 'projectStreetSegmentId', 'searchSessionId', 'userId', 'algorithmVersion'] as const;
  for (const field of requiredStrings) if (typeof data[field] !== 'string') throw new Error(`Street coverage contribution ${id} is invalid.`);
  if (!finite(data.startOffsetMetres) || !finite(data.endOffsetMetres) || !finite(data.coveragePolicyVersion)) throw new Error(`Street coverage contribution ${id} is invalid.`);
  return {
    projectId: data.projectId as string,
    projectStreetSegmentId: data.projectStreetSegmentId as string,
    searchSessionId: data.searchSessionId as string,
    userId: data.userId as string,
    evidenceId: typeof data.evidenceId === 'string' ? data.evidenceId : id,
    startOffsetMetres: data.startOffsetMetres,
    endOffsetMetres: data.endOffsetMetres,
    algorithmVersion: data.algorithmVersion as string,
    coveragePolicyVersion: data.coveragePolicyVersion,
  };
}

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
      firestore.collection('projectStreetSegments').where('workspaceId', '==', authority.workspaceId).where('projectId', '==', project.id).where('eligible', '==', true).get(),
      firestore.collection('streetCoverageContributions').where('workspaceId', '==', authority.workspaceId).where('projectId', '==', project.id).where('status', '==', 'ACCEPTED').get(),
    ]);
    const contributions = contributionSnapshot.docs.map((document) => contribution(document.id, document.data()));
    const streetSegments = segmentSnapshot.docs.map((document) => {
      const segment = projectStreetSegment(document.id, document.data());
      return buildProjectStreetCoverageView({ segment, contributions, policy, verified: document.get('verificationStatus') === 'VERIFIED' });
    });

    return {
      projectId: project.id,
      ownership: 'PROJECT_SHARED',
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
