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
  const partialTraversalPercent = snapshot.get('thresholds.partialTraversalPercent');
  const coveredTraversalPercent = snapshot.get('thresholds.coveredTraversalPercent');
  const algorithmVersion = snapshot.get('algorithmVersion');
  const mode = snapshot.get('mode');

  if (!finite(version) || !finite(maximumGpsAccuracyMetres) || !finite(maximumContinuityGapSeconds) || !finite(partialTraversalPercent) || !finite(coveredTraversalPercent) || typeof algorithmVersion !== 'string' || typeof mode !== 'string') {
    throw new AuthorisationError('Coverage policy configuration is incomplete.');
  }
  if (maximumGpsAccuracyMetres <= 0 || maximumContinuityGapSeconds <= 0 || partialTraversalPercent < 0 || coveredTraversalPercent > 100 || partialTraversalPercent >= coveredTraversalPercent) {
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
    partialTraversalPercent,
    coveredTraversalPercent,
    verificationRequired: snapshot.get('verificationRequired') !== false,
    algorithmVersion,
  };
}
