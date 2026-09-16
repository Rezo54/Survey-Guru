import type { Firestore } from 'firebase-admin/firestore';
import {
  buildMapMatchEvidence,
  contributionFromMatch,
  generateMapMatchCandidates,
  resolveMapMatch,
  type CandidateTraversal,
  type CoverageContribution,
  type MapMatchPolicy,
  type PersistableMapMatchEvidence,
  type ProjectStreetSegment,
} from './map-matching.js';

export type AcceptedMovementPoint = Readonly<{
  id: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  validationStatus: 'ACCEPTED';
}>;

export type ReconciliationPolicy = MapMatchPolicy & Readonly<{
  maximumGpsAccuracyMetres: number;
  maximumContinuityGapSeconds: number;
}>;

export type MapMatchDecision =
  | Readonly<{ status: 'SKIPPED_UNSUPPORTED_TRAVERSAL'; reason: string }>
  | Readonly<{
      status: 'MATCHED' | 'AMBIGUOUS' | 'NO_MATCH';
      evidence: PersistableMapMatchEvidence;
      contribution: CoverageContribution | null;
    }>;

function validPoint(point: AcceptedMovementPoint): boolean {
  return Boolean(point.id) && Number.isFinite(Date.parse(point.capturedAt)) &&
    Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 &&
    Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180 &&
    Number.isFinite(point.accuracyMetres) && point.accuracyMetres >= 0;
}

export function reconcileMapMatch(input: Readonly<{
  workspaceId: string;
  projectId: string;
  searchSessionId: string;
  userId: string;
  from: AcceptedMovementPoint;
  to: AcceptedMovementPoint;
  projectStreetSegments: readonly ProjectStreetSegment[];
  previousProjectStreetSegmentId?: string;
  policy: ReconciliationPolicy;
  createdAt: string;
}>): MapMatchDecision {
  if (!validPoint(input.from) || !validPoint(input.to)) return { status: 'SKIPPED_UNSUPPORTED_TRAVERSAL', reason: 'Movement evidence is invalid.' };
  if (input.from.accuracyMetres > input.policy.maximumGpsAccuracyMetres || input.to.accuracyMetres > input.policy.maximumGpsAccuracyMetres) {
    return { status: 'SKIPPED_UNSUPPORTED_TRAVERSAL', reason: 'Movement evidence exceeds the active GPS accuracy policy.' };
  }
  const elapsedSeconds = (Date.parse(input.to.capturedAt) - Date.parse(input.from.capturedAt)) / 1000;
  if (elapsedSeconds <= 0 || elapsedSeconds > input.policy.maximumContinuityGapSeconds) {
    return { status: 'SKIPPED_UNSUPPORTED_TRAVERSAL', reason: 'Movement evidence does not form a continuous chronological traversal.' };
  }

  const traversal: CandidateTraversal = {
    id: `ct_${input.from.id}_${input.to.id}`,
    from: { latitude: input.from.latitude, longitude: input.from.longitude },
    to: { latitude: input.to.latitude, longitude: input.to.longitude },
    fromEvidenceId: input.from.id,
    toEvidenceId: input.to.id,
  };
  const candidateInput = input.previousProjectStreetSegmentId
    ? { traversal, projectStreetSegments: input.projectStreetSegments, previousProjectStreetSegmentId: input.previousProjectStreetSegmentId }
    : { traversal, projectStreetSegments: input.projectStreetSegments };
  const candidates = generateMapMatchCandidates(candidateInput);
  const outcomeInput = input.previousProjectStreetSegmentId
    ? { workspaceId: input.workspaceId, projectId: input.projectId, previousProjectStreetSegmentId: input.previousProjectStreetSegmentId, candidates, policy: input.policy }
    : { workspaceId: input.workspaceId, projectId: input.projectId, candidates, policy: input.policy };
  const outcome = resolveMapMatch(outcomeInput);
  const evidence = buildMapMatchEvidence({
    id: `mme_${traversal.id}`,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    searchSessionId: input.searchSessionId,
    traversal,
    candidates,
    outcome,
    policy: input.policy,
    createdAt: input.createdAt,
  });
  const contribution = contributionFromMatch({
    outcome,
    projectId: input.projectId,
    searchSessionId: input.searchSessionId,
    userId: input.userId,
    evidenceId: evidence.id,
    policy: input.policy,
  });
  return { status: outcome.status, evidence, contribution };
}

export async function persistMapMatchDecision(
  firestore: Firestore,
  input: Readonly<{ workspaceId: string; decision: Exclude<MapMatchDecision, { status: 'SKIPPED_UNSUPPORTED_TRAVERSAL' }> }>,
): Promise<'CREATED' | 'ALREADY_EXISTS'> {
  const evidenceRef = firestore.collection('mapMatchEvidence').doc(input.decision.evidence.id);
  return firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(evidenceRef);
    if (existing.exists) return 'ALREADY_EXISTS';
    transaction.create(evidenceRef, input.decision.evidence);
    if (input.decision.contribution) {
      const contribution = input.decision.contribution;
      const contributionRef = firestore.collection('streetCoverageContributions').doc(`scc_${input.decision.evidence.id}_${contribution.projectStreetSegmentId}`);
      transaction.create(contributionRef, {
        ...contribution,
        workspaceId: input.workspaceId,
        mapMatchEvidenceId: input.decision.evidence.id,
        status: 'ACCEPTED',
        createdAt: input.decision.evidence.createdAt,
      });
    }
    return 'CREATED';
  });
}
