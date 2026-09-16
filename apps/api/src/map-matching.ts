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
  connectedProjectStreetSegmentIds?: readonly string[];
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

export type CandidateTraversal = Readonly<{
  id: string;
  from: Coordinate;
  to: Coordinate;
  fromEvidenceId: string;
  toEvidenceId: string;
}>;

export type PersistableMapMatchEvidence = Readonly<{
  id: string;
  workspaceId: string;
  projectId: string;
  searchSessionId: string;
  candidateTraversalId: string;
  sourceEvidenceIds: readonly string[];
  outcome: MatchOutcome['status'];
  selectedProjectStreetSegmentId: string | null;
  reason: string;
  candidates: ReadonlyArray<Readonly<{
    projectStreetSegmentId: string;
    lateralDistanceMetres: number;
    headingDeltaDegrees: number;
    continuityScore: number;
    startOffsetMetres: number;
    endOffsetMetres: number;
    continuesFromPrevious: boolean;
  }>>;
  algorithmVersion: string;
  coveragePolicyVersion: number;
  createdAt: string;
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

function toLocalMetres(point: Coordinate, origin: Coordinate): Readonly<{ x: number; y: number }> {
  const earth = 6_371_000;
  const latitudeRadians = origin.latitude * Math.PI / 180;
  return {
    x: (point.longitude - origin.longitude) * Math.PI / 180 * earth * Math.cos(latitudeRadians),
    y: (point.latitude - origin.latitude) * Math.PI / 180 * earth,
  };
}

function distanceBetween(left: Coordinate, right: Coordinate): number {
  const local = toLocalMetres(right, left);
  return Math.hypot(local.x, local.y);
}

function headingDegrees(from: Coordinate, to: Coordinate): number {
  const local = toLocalMetres(to, from);
  return (Math.atan2(local.x, local.y) * 180 / Math.PI + 360) % 360;
}

function undirectedHeadingDelta(left: number, right: number): number {
  const directed = Math.abs(left - right) % 360;
  const shortest = Math.min(directed, 360 - directed);
  return Math.min(shortest, 180 - shortest);
}

function projectOntoSegment(point: Coordinate, from: Coordinate, to: Coordinate): Readonly<{ distanceMetres: number; fraction: number }> {
  const projectedPoint = toLocalMetres(point, from);
  const projectedEnd = toLocalMetres(to, from);
  const squaredLength = projectedEnd.x ** 2 + projectedEnd.y ** 2;
  if (squaredLength === 0) return { distanceMetres: Math.hypot(projectedPoint.x, projectedPoint.y), fraction: 0 };
  const fraction = clamp((projectedPoint.x * projectedEnd.x + projectedPoint.y * projectedEnd.y) / squaredLength, 0, 1);
  return {
    distanceMetres: Math.hypot(projectedPoint.x - fraction * projectedEnd.x, projectedPoint.y - fraction * projectedEnd.y),
    fraction,
  };
}

function projectOntoPolyline(point: Coordinate, geometry: readonly Coordinate[]): Readonly<{ distanceMetres: number; offsetMetres: number; headingDegrees: number }> | null {
  let traversedMetres = 0;
  let best: { distanceMetres: number; offsetMetres: number; headingDegrees: number } | null = null;
  for (let index = 1; index < geometry.length; index += 1) {
    const from = geometry[index - 1];
    const to = geometry[index];
    if (!from || !to) continue;
    const segmentLength = distanceBetween(from, to);
    if (segmentLength === 0) continue;
    const projection = projectOntoSegment(point, from, to);
    const candidate = { distanceMetres: projection.distanceMetres, offsetMetres: traversedMetres + projection.fraction * segmentLength, headingDegrees: headingDegrees(from, to) };
    if (!best || candidate.distanceMetres < best.distanceMetres) best = candidate;
    traversedMetres += segmentLength;
  }
  return best;
}

/** Generates candidates only; resolveMapMatch remains the authority for accepting one. */
export function generateMapMatchCandidates(input: Readonly<{
  traversal: CandidateTraversal;
  projectStreetSegments: readonly ProjectStreetSegment[];
  previousProjectStreetSegmentId?: string;
}>): readonly MatchCandidate[] {
  const traversalMetres = distanceBetween(input.traversal.from, input.traversal.to);
  if (!finite(traversalMetres) || traversalMetres <= 0) return [];
  const traversalHeading = headingDegrees(input.traversal.from, input.traversal.to);

  return input.projectStreetSegments.flatMap((segment): MatchCandidate[] => {
    if (!segment.eligible || segment.geometry.length < 2 || segment.lengthMetres <= 0) return [];
    const start = projectOntoPolyline(input.traversal.from, segment.geometry);
    const end = projectOntoPolyline(input.traversal.to, segment.geometry);
    if (!start || !end) return [];
    const matchedMetres = Math.abs(end.offsetMetres - start.offsetMetres);
    const continuityScore = clamp(1 - Math.abs(traversalMetres - matchedMetres) / Math.max(traversalMetres, matchedMetres, 1), 0, 1);
    const sameAsPrevious = input.previousProjectStreetSegmentId === segment.id;
    const connectedToPrevious = !input.previousProjectStreetSegmentId || sameAsPrevious || segment.connectedProjectStreetSegmentIds?.includes(input.previousProjectStreetSegmentId) === true;
    return [{
      projectStreetSegment: segment,
      lateralDistanceMetres: Number(Math.max(start.distanceMetres, end.distanceMetres).toFixed(3)),
      headingDeltaDegrees: Number(Math.max(undirectedHeadingDelta(traversalHeading, start.headingDegrees), undirectedHeadingDelta(traversalHeading, end.headingDegrees)).toFixed(3)),
      continuityScore: Number(continuityScore.toFixed(6)),
      startOffsetMetres: Number(start.offsetMetres.toFixed(3)),
      endOffsetMetres: Number(end.offsetMetres.toFixed(3)),
      continuesFromPrevious: connectedToPrevious,
    }];
  });
}

export function buildMapMatchEvidence(input: Readonly<{
  id: string;
  workspaceId: string;
  projectId: string;
  searchSessionId: string;
  traversal: CandidateTraversal;
  candidates: readonly MatchCandidate[];
  outcome: MatchOutcome;
  policy: MapMatchPolicy;
  createdAt: string;
}>): PersistableMapMatchEvidence {
  if (!input.id || !input.searchSessionId || !Number.isFinite(Date.parse(input.createdAt))) throw new Error('Map-match evidence identity or timestamp is invalid.');
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    searchSessionId: input.searchSessionId,
    candidateTraversalId: input.traversal.id,
    sourceEvidenceIds: [input.traversal.fromEvidenceId, input.traversal.toEvidenceId],
    outcome: input.outcome.status,
    selectedProjectStreetSegmentId: input.outcome.status === 'MATCHED' ? input.outcome.candidate.projectStreetSegment.id : null,
    reason: input.outcome.reason,
    candidates: input.candidates.map((candidate) => ({
      projectStreetSegmentId: candidate.projectStreetSegment.id,
      lateralDistanceMetres: candidate.lateralDistanceMetres,
      headingDeltaDegrees: candidate.headingDeltaDegrees,
      continuityScore: candidate.continuityScore,
      startOffsetMetres: candidate.startOffsetMetres,
      endOffsetMetres: candidate.endOffsetMetres,
      continuesFromPrevious: candidate.continuesFromPrevious,
    })),
    algorithmVersion: input.policy.algorithmVersion,
    coveragePolicyVersion: input.policy.coveragePolicyVersion,
    createdAt: new Date(input.createdAt).toISOString(),
  };
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
