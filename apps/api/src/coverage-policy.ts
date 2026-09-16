import type { Firestore } from 'firebase-admin/firestore';
import { AuthorisationError } from './authority.js';

export type CoveragePolicy = {
  id: string;
  workspaceId: string;
  projectId: string;
  version: number;
  mode: string;
  maximumGpsAccuracyMetres: number;
  maximumContinuityGapSeconds: number;
  maximumMapMatchDistanceMetres: number;
  maximumHeadingDeltaDegrees: number;
  minimumContinuityScore: number;
  ambiguityScoreGap: number;
  partialTraversalPercent: number;
  coveredTraversalPercent: number;
  verificationRequired: boolean;
  algorithmVersion: string;
};

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function resolveCoveragePolicy(
  firestore: Firestore,
  input: { coveragePolicyId: unknown; workspaceId: string; projectId: string },
): Promise<CoveragePolicy> {
  if (typeof input.coveragePolicyId !== 'string' || !input.coveragePolicyId) {
    throw new AuthorisationError('Search session does not reference an active coverage policy.');
  }

  const snapshot = await firestore.collection('coveragePolicies').doc(input.coveragePolicyId).get();
  if (!snapshot.exists || snapshot.get('workspaceId') !== input.workspaceId || snapshot.get('projectId') !== input.projectId) {
    throw new AuthorisationError('Coverage policy is outside the authorised project scope.');
  }

  const version = snapshot.get('version');
  const maximumGpsAccuracyMetres = snapshot.get('minimumGpsAccuracyRule.maximumMetres');
  const maximumContinuityGapSeconds = snapshot.get('continuityRule.maximumGapSeconds');
  const maximumMapMatchDistanceMetres = snapshot.get('mapMatching.maximumLateralDistanceMetres');
  const maximumHeadingDeltaDegrees = snapshot.get('mapMatching.maximumHeadingDeltaDegrees');
  const minimumContinuityScore = snapshot.get('mapMatching.minimumContinuityScore');
  const ambiguityScoreGap = snapshot.get('mapMatching.ambiguityScoreGap');
  const partialTraversalPercent = snapshot.get('thresholds.partialTraversalPercent');
  const coveredTraversalPercent = snapshot.get('thresholds.coveredTraversalPercent');
  const algorithmVersion = snapshot.get('algorithmVersion');
  const mode = snapshot.get('mode');

  if (!finite(version) || !finite(maximumGpsAccuracyMetres) || !finite(maximumContinuityGapSeconds) || !finite(maximumMapMatchDistanceMetres) || !finite(maximumHeadingDeltaDegrees) || !finite(minimumContinuityScore) || !finite(ambiguityScoreGap) || !finite(partialTraversalPercent) || !finite(coveredTraversalPercent) || typeof algorithmVersion !== 'string' || typeof mode !== 'string') {
    throw new AuthorisationError('Coverage policy configuration is incomplete.');
  }
  if (maximumGpsAccuracyMetres <= 0 || maximumContinuityGapSeconds <= 0 || maximumMapMatchDistanceMetres <= 0 || maximumHeadingDeltaDegrees <= 0 || maximumHeadingDeltaDegrees > 180 || minimumContinuityScore < 0 || minimumContinuityScore > 1 || ambiguityScoreGap < 0 || ambiguityScoreGap > 1 || partialTraversalPercent < 0 || coveredTraversalPercent > 100 || partialTraversalPercent >= coveredTraversalPercent) {
    throw new AuthorisationError('Coverage policy configuration is invalid.');
  }

  return {
    id: snapshot.id,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    version,
    mode,
    maximumGpsAccuracyMetres,
    maximumContinuityGapSeconds,
    maximumMapMatchDistanceMetres,
    maximumHeadingDeltaDegrees,
    minimumContinuityScore,
    ambiguityScoreGap,
    partialTraversalPercent,
    coveredTraversalPercent,
    verificationRequired: snapshot.get('verificationRequired') !== false,
    algorithmVersion,
  };
}
