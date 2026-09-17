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

    const [segmentSnapshot, contributionSnapshot, capturesSnapshot] = await Promise.all([
      firestore.collection('projectStreetSegments').where('projectId', '==', project.id).get(),
      firestore.collection('streetCoverageContributions').where('projectId', '==', project.id).get(),
      firestore.collection('storeCaptures').where('projectId', '==', project.id).limit(500).get(),
    ]);
    const contributions = contributionSnapshot.docs
      .filter((document) => document.get('workspaceId') === authority.workspaceId && document.get('status') === 'ACCEPTED')
      .map((document) => parseCoverageContribution(document.id, document.data()));
    const streetSegments = segmentSnapshot.docs.filter((document) => document.get('workspaceId') === authority.workspaceId && document.get('eligible') === true).map((document) => {
      const segment = parseProjectStreetSegment(document.id, document.data());
      return buildProjectStreetCoverageView({ segment, contributions, policy, verified: document.get('verificationStatus') === 'VERIFIED' });
    });
    const authorisedCaptures = capturesSnapshot.docs.filter((document) => document.get('workspaceId') === authority.workspaceId);
    const capturerIds = Array.from(new Set(authorisedCaptures.map((document) => document.get('capturerUserId')).filter((value): value is string => typeof value === 'string')));
    const capturerEntries = await Promise.all(capturerIds.map(async (userId) => {
      const user = await firestore.collection('users').doc(userId).get();
      return [userId, user.get('displayName') ?? user.get('email') ?? userId] as const;
    }));
    const capturerNames = new Map(capturerEntries);
    const projectTimeZone = typeof project.get('timeZone') === 'string' ? project.get('timeZone') : 'Africa/Johannesburg';
    const projectDay = (value: unknown) => {
      const date = new Date(String(value ?? ''));
      return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: projectTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '';
    };
    const today = projectDay(new Date().toISOString());
    const capturedStores = authorisedCaptures
      .filter((document) => ['VERIFIED', 'READY_FOR_EXPORT', 'SYNCED'].includes(String(document.get('status'))))
      .map((document) => ({
        captureId: document.id,
        storeId: document.get('resolvedStoreId'),
        name: document.get('observedName'),
        status: document.get('status'),
        location: document.get('location'),
        answers: document.get('answers'),
        capturerUserId: document.get('capturerUserId'),
        capturerName: capturerNames.get(String(document.get('capturerUserId'))) ?? document.get('capturerUserId'),
        capturedAt: document.get('submittedAt') ?? document.get('updatedAt'),
        projectTimeZone: document.get('projectTimeZone') ?? projectTimeZone,
        capturedLocalTime: document.get('submittedLocalTime') ?? null,
        capturedToday: projectDay(document.get('submittedAt') ?? document.get('updatedAt')) === today,
        photoCount: Array.isArray(document.get('photos')) ? document.get('photos').length : 0,
        exportState: document.get('exportJobId') ? 'QUEUED' : 'NOT_QUEUED',
      }));
    const brandCounts = new Map<string, number>();
    for (const document of authorisedCaptures) {
      const answers = document.get('answers') as Record<string, unknown> | undefined;
      const modernBrands = Array.isArray(answers?.brandProducts) ? answers.brandProducts.map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).brand : undefined) : [];
      const brands = modernBrands.length ? modernBrands : Array.isArray(answers?.stockedBrands) ? answers.stockedBrands : [];
      for (const brand of brands) if (typeof brand === 'string' && brand.trim()) brandCounts.set(brand.trim(), (brandCounts.get(brand.trim()) ?? 0) + 1);
    }
    const statusCounts = Object.fromEntries(authorisedCaptures.reduce((counts, document) => {
      const status = String(document.get('status') ?? 'UNKNOWN'); counts.set(status, (counts.get(status) ?? 0) + 1); return counts;
    }, new Map<string, number>()));
    const areaSquareKm = Number(project.get('boundaryAreaSquareKm') ?? 0);

    return {
      projectId: project.id,
      ownership: 'PROJECT_SHARED',
      projectBoundary: parseOptionalBoundary(project.get('boundary')),
      streetSegments,
      capturedStores,
      storeInsights: {
        totalCaptures: authorisedCaptures.length,
        correctCaptures: capturedStores.length,
        capturedToday: capturedStores.filter((store) => store.capturedToday).length,
        densityPerSquareKm: areaSquareKm > 0 ? Number((capturedStores.length / areaSquareKm).toFixed(2)) : null,
        statusCounts,
        brandPerformance: [...brandCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 10).map(([brand, stores]) => ({ brand, stores })),
        capturers: capturerIds.map((userId) => ({ userId, name: capturerNames.get(userId) ?? userId, captures: capturedStores.filter((store) => store.capturerUserId === userId).length })),
      },
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
