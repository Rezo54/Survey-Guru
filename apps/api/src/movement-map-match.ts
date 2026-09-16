import type { Firestore } from 'firebase-admin/firestore';
import { resolveCoveragePolicy } from './coverage-policy.js';
import {
  persistMapMatchDecision,
  reconcileMapMatch,
  type AcceptedMovementPoint,
  type ReconciliationPolicy,
} from './map-match-persistence.js';
import { parseProjectStreetSegment } from './street-coverage-data.js';

type ReconcileAcceptedPairInput = Readonly<{
  workspaceId: string;
  projectId: string;
  searchSessionId: string;
  userId: string;
  coveragePolicyId: unknown;
  from: AcceptedMovementPoint;
  to: AcceptedMovementPoint;
  createdAt: string;
}>;

export type AcceptedPairResult = Readonly<{
  status: 'SKIPPED_UNSUPPORTED_TRAVERSAL' | 'MATCHED' | 'AMBIGUOUS' | 'NO_MATCH';
  persistence: 'NOT_APPLICABLE' | 'CREATED' | 'ALREADY_EXISTS';
  contributionCreated: boolean;
  reason: string;
  mapMatchEvidenceId: string | null;
}>;

export function findPreviousMatchedSegment(
  documents: ReadonlyArray<Readonly<{ data: Record<string, unknown> }>>,
  input: Readonly<{ workspaceId: string; projectId: string; fromEvidenceId: string }>,
): string | undefined {
  const matches = documents
    .map((document) => document.data)
    .filter((data) => data.workspaceId === input.workspaceId && data.projectId === input.projectId && data.outcome === 'MATCHED')
    .filter((data) => Array.isArray(data.sourceEvidenceIds) && data.sourceEvidenceIds[1] === input.fromEvidenceId)
    .filter((data) => typeof data.selectedProjectStreetSegmentId === 'string')
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const selected = matches[0]?.selectedProjectStreetSegmentId;
  return typeof selected === 'string' ? selected : undefined;
}

export async function reconcileAcceptedMovementPair(firestore: Firestore, input: ReconcileAcceptedPairInput): Promise<AcceptedPairResult> {
  const coveragePolicy = await resolveCoveragePolicy(firestore, { coveragePolicyId: input.coveragePolicyId, workspaceId: input.workspaceId, projectId: input.projectId });
  const policy: ReconciliationPolicy = {
    maximumGpsAccuracyMetres: coveragePolicy.maximumGpsAccuracyMetres,
    maximumContinuityGapSeconds: coveragePolicy.maximumContinuityGapSeconds,
    maximumLateralDistanceMetres: coveragePolicy.maximumMapMatchDistanceMetres,
    maximumHeadingDeltaDegrees: coveragePolicy.maximumHeadingDeltaDegrees,
    minimumContinuityScore: coveragePolicy.minimumContinuityScore,
    ambiguityScoreGap: coveragePolicy.ambiguityScoreGap,
    partialTraversalPercent: coveragePolicy.partialTraversalPercent,
    coveredTraversalPercent: coveragePolicy.coveredTraversalPercent,
    algorithmVersion: coveragePolicy.algorithmVersion,
    coveragePolicyVersion: coveragePolicy.version,
  };
  const [segmentSnapshot, historySnapshot] = await Promise.all([
    firestore.collection('projectStreetSegments').where('projectId', '==', input.projectId).get(),
    firestore.collection('mapMatchEvidence').where('searchSessionId', '==', input.searchSessionId).get(),
  ]);
  const projectStreetSegments = segmentSnapshot.docs
    .filter((document) => document.get('workspaceId') === input.workspaceId && document.get('eligible') === true)
    .map((document) => parseProjectStreetSegment(document.id, document.data()));
  const previousProjectStreetSegmentId = findPreviousMatchedSegment(
    historySnapshot.docs.map((document) => ({ data: document.data() })),
    { workspaceId: input.workspaceId, projectId: input.projectId, fromEvidenceId: input.from.id },
  );
  const base = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    searchSessionId: input.searchSessionId,
    userId: input.userId,
    from: input.from,
    to: input.to,
    projectStreetSegments,
    policy,
    createdAt: input.createdAt,
  };
  const decision = previousProjectStreetSegmentId ? reconcileMapMatch({ ...base, previousProjectStreetSegmentId }) : reconcileMapMatch(base);
  if (decision.status === 'SKIPPED_UNSUPPORTED_TRAVERSAL') {
    return { status: decision.status, persistence: 'NOT_APPLICABLE', contributionCreated: false, reason: decision.reason, mapMatchEvidenceId: null };
  }
  const persistence = await persistMapMatchDecision(firestore, { workspaceId: input.workspaceId, decision });
  return {
    status: decision.status,
    persistence,
    contributionCreated: decision.status === 'MATCHED' && persistence === 'CREATED' && decision.contribution !== null,
    reason: decision.evidence.reason,
    mapMatchEvidenceId: decision.evidence.id,
  };
}
