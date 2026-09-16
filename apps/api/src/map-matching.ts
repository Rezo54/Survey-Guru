export type Coordinate = Readonly<{ latitude: number; longitude: number }>;

export type ProjectStreetSegment = Readonly<{
  id: string;
  workspaceId: string;
  projectId: string;
  streetSegmentId: string;
  eligible: boolean;
  lengthMetres: number;
  geometry: readonly Coordinate[];
  source: Readonly<{
    provider: string;
    sourceId: string;
    sourceVersion: string;
  }>;
}>;

export type MatchCandidate = Readonly<{
  projectStreetSegment: ProjectStreetSegment;
  lateralDistanceMetres: number;
  headingDeltaDegrees: number;
  continuityScore: number;
  startOffsetMetres: number;
  endOffsetMetres: number;
  continuesFromPrevious: boolean;
}>;

export type MapMatchPolicy = Readonly<{
  maximumLateralDistanceMetres: number;
  maximumHeadingDeltaDegrees: number;
  minimumContinuityScore: number;
  ambiguityScoreGap: number;
  partialTraversalPercent: number;
  coveredTraversalPercent: number;
  algorithmVersion: string;
  coveragePolicyVersion: number;
}>;

export type MatchOutcome =
  | Readonly<{ status: 'MATCHED'; candidate: MatchCandidate; score: number; reason: string }>
  | Readonly<{ status: 'AMBIGUOUS'; candidates: readonly MatchCandidate[]; reason: string }>
  | Readonly<{ status: 'NO_MATCH'; reason: string }>;

export type CoverageContribution = Readonly<{
  projectId: string;
  projectStreetSegmentId: string;
  searchSessionId: string;
  userId: string;
  evidenceId: string;
  startOffsetMetres: number;
  endOffsetMetres: number;
  algorithmVersion: string;
  coveragePolicyVersion: number;
}>;

export type StreetCoverageState = 'UNCOVERED' | 'PARTIALLY_COVERED' | 'COVERED' | 'VERIFIED';

export type ProjectStreetCoverageView = Readonly<{
  projectStreetSegmentId: string;
  streetSegmentId: string;
  geometry: readonly Coordinate[];
  coverageState: StreetCoverageState;
  coverageColour: 'red' | 'amber' | 'green';
  coveredMetres: number;
  coveragePercent: number;
  algorithmVersion: string;
  coveragePolicyVersion: number;
}>;

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertPolicy(policy: MapMatchPolicy): void {
  if (
    !finite(policy.maximumLateralDistanceMetres) || policy.maximumLateralDistanceMetres <= 0 ||
    !finite(policy.maximumHeadingDeltaDegrees) || policy.maximumHeadingDeltaDegrees <= 0 || policy.maximumHeadingDeltaDegrees > 180 ||
    !finite(policy.minimumContinuityScore) || policy.minimumContinuityScore < 0 || policy.minimumContinuityScore > 1 ||
    !finite(policy.ambiguityScoreGap) || policy.ambiguityScoreGap < 0 || policy.ambiguityScoreGap > 1 ||
    !finite(policy.partialTraversalPercent) || !finite(policy.coveredTraversalPercent) ||
    policy.partialTraversalPercent < 0 || policy.coveredTraversalPercent > 100 ||
    policy.partialTraversalPercent >= policy.coveredTraversalPercent ||
    !policy.algorithmVersion || !Number.isInteger(policy.coveragePolicyVersion) || policy.coveragePolicyVersion < 1
  ) {
    throw new Error('Map-match policy is invalid.');
  }
}

function candidateScore(candidate: MatchCandidate, policy: MapMatchPolicy): number {
  const distanceScore = 1 - candidate.lateralDistanceMetres / policy.maximumLateralDistanceMetres;
  const headingScore = 1 - candidate.headingDeltaDegrees / policy.maximumHeadingDeltaDegrees;
  return 0.45 * clamp(distanceScore, 0, 1) + 0.35 * clamp(headingScore, 0, 1) + 0.2 * clamp(candidate.continuityScore, 0, 1);
}

/**
 * Resolves already-generated GIS candidates conservatively. Candidate generation and
 * geometry projection belong to a replaceable GIS adapter; this boundary decides
 * whether any candidate is safe enough to support coverage.
 */
export function resolveMapMatch(input: Readonly<{
  workspaceId: string;
  projectId: string;
  previousProjectStreetSegmentId?: string;
  candidates: readonly MatchCandidate[];
  policy: MapMatchPolicy;
}>): MatchOutcome {
  assertPolicy(input.policy);

  const eligible = input.candidates.filter((candidate) => {
    const segment = candidate.projectStreetSegment;
    if (!segment.eligible || segment.workspaceId !== input.workspaceId || segment.projectId !== input.projectId) return false;
    if (!finite(segment.lengthMetres) || segment.lengthMetres <= 0 || segment.geometry.length < 2) return false;
    if (!finite(candidate.lateralDistanceMetres) || candidate.lateralDistanceMetres < 0 || candidate.lateralDistanceMetres > input.policy.maximumLateralDistanceMetres) return false;
    if (!finite(candidate.headingDeltaDegrees) || candidate.headingDeltaDegrees < 0 || candidate.headingDeltaDegrees > input.policy.maximumHeadingDeltaDegrees) return false;
    if (!finite(candidate.continuityScore) || candidate.continuityScore < input.policy.minimumContinuityScore) return false;
    if (!finite(candidate.startOffsetMetres) || !finite(candidate.endOffsetMetres)) return false;
    if (input.previousProjectStreetSegmentId && segment.id !== input.previousProjectStreetSegmentId && !candidate.continuesFromPrevious) return false;
    return true;
  });

  if (eligible.length === 0) {
    return { status: 'NO_MATCH', reason: 'No eligible project segment passed distance, direction and sequence-continuity safeguards.' };
  }

  const ranked = eligible
    .map((candidate) => ({ candidate, score: candidateScore(candidate, input.policy) }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best) return { status: 'NO_MATCH', reason: 'No eligible project segment was available.' };

  const runnerUp = ranked.find((entry) => entry.candidate.projectStreetSegment.id !== best.candidate.projectStreetSegment.id);
  if (runnerUp && best.score - runnerUp.score < input.policy.ambiguityScoreGap) {
    return {
      status: 'AMBIGUOUS',
      candidates: [best.candidate, runnerUp.candidate],
      reason: 'Competing street segments are too similar to safely select one; no coverage contribution is allowed.',
    };
  }

  return {
    status: 'MATCHED',
    candidate: best.candidate,
    score: Number(best.score.toFixed(6)),
    reason: 'One eligible project segment passed distance, direction, continuity and ambiguity safeguards.',
  };
}

export function contributionFromMatch(input: Readonly<{
  outcome: MatchOutcome;
  projectId: string;
  searchSessionId: string;
  userId: string;
  evidenceId: string;
  policy: MapMatchPolicy;
}>): CoverageContribution | null {
  if (input.outcome.status !== 'MATCHED') return null;
  const candidate = input.outcome.candidate;
  if (input.projectId !== candidate.projectStreetSegment.projectId) return null;
  const length = candidate.projectStreetSegment.lengthMetres;
  const startOffsetMetres = clamp(Math.min(candidate.startOffsetMetres, candidate.endOffsetMetres), 0, length);
  const endOffsetMetres = clamp(Math.max(candidate.startOffsetMetres, candidate.endOffsetMetres), 0, length);
  if (endOffsetMetres <= startOffsetMetres) return null;

  return {
    projectId: input.projectId,
    projectStreetSegmentId: candidate.projectStreetSegment.id,
    searchSessionId: input.searchSessionId,
    userId: input.userId,
    evidenceId: input.evidenceId,
    startOffsetMetres,
    endOffsetMetres,
    algorithmVersion: input.policy.algorithmVersion,
    coveragePolicyVersion: input.policy.coveragePolicyVersion,
  };
}

/** Repeated and overlapping walks are unioned by segment, irrespective of capturer. */
export function uniqueCoveredMetres(segment: ProjectStreetSegment, contributions: readonly CoverageContribution[]): number {
  const intervals = contributions
    .filter((item) => item.projectId === segment.projectId && item.projectStreetSegmentId === segment.id)
    .map((item) => [
      clamp(Math.min(item.startOffsetMetres, item.endOffsetMetres), 0, segment.lengthMetres),
      clamp(Math.max(item.startOffsetMetres, item.endOffsetMetres), 0, segment.lengthMetres),
    ] as const)
    .filter(([start, end]) => finite(start) && finite(end) && end > start)
    .sort((left, right) => left[0] - right[0]);

  let total = 0;
  let currentStart: number | undefined;
  let currentEnd: number | undefined;
  for (const [start, end] of intervals) {
    if (currentStart === undefined || currentEnd === undefined) {
      currentStart = start;
      currentEnd = end;
    } else if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      total += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  if (currentStart !== undefined && currentEnd !== undefined) total += currentEnd - currentStart;
  return Number(Math.min(segment.lengthMetres, total).toFixed(3));
}

export function buildProjectStreetCoverageView(input: Readonly<{
  segment: ProjectStreetSegment;
  contributions: readonly CoverageContribution[];
  policy: MapMatchPolicy;
  verified?: boolean;
}>): ProjectStreetCoverageView {
  assertPolicy(input.policy);
  const currentContributions = input.contributions.filter((item) => item.algorithmVersion === input.policy.algorithmVersion && item.coveragePolicyVersion === input.policy.coveragePolicyVersion);
  const coveredMetres = uniqueCoveredMetres(input.segment, currentContributions);
  const coveragePercent = Number((coveredMetres / input.segment.lengthMetres * 100).toFixed(2));
  let coverageState: StreetCoverageState = 'UNCOVERED';
  if (coveragePercent >= input.policy.coveredTraversalPercent) coverageState = input.verified ? 'VERIFIED' : 'COVERED';
  else if (coveragePercent >= input.policy.partialTraversalPercent) coverageState = 'PARTIALLY_COVERED';

  return {
    projectStreetSegmentId: input.segment.id,
    streetSegmentId: input.segment.streetSegmentId,
    geometry: input.segment.geometry,
    coverageState,
    coverageColour: coverageState === 'UNCOVERED' ? 'red' : coverageState === 'PARTIALLY_COVERED' ? 'amber' : 'green',
    coveredMetres,
    coveragePercent,
    algorithmVersion: input.policy.algorithmVersion,
    coveragePolicyVersion: input.policy.coveragePolicyVersion,
  };
}
