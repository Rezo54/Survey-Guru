import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProjectStreetCoverageView,
  buildStreetCoverageSlices,
  buildMapMatchEvidence,
  contributionFromMatch,
  generateMapMatchCandidates,
  resolveMapMatch,
  uniqueCoveredMetres,
  sliceStreetGeometry,
  type CoverageContribution,
  type MatchCandidate,
  type MapMatchPolicy,
  type ProjectStreetSegment,
} from '../src/map-matching.js';
import { reconcileMapMatch, type ReconciliationPolicy } from '../src/map-match-persistence.js';
import { findPreviousMatchedSegment } from '../src/movement-map-match.js';
import { parseProjectStreetSegment } from '../src/street-coverage-data.js';

const policy: MapMatchPolicy = {
  maximumLateralDistanceMetres: 25,
  maximumHeadingDeltaDegrees: 40,
  minimumContinuityScore: 0.65,
  ambiguityScoreGap: 0.12,
  partialTraversalPercent: 25,
  coveredTraversalPercent: 85,
  algorithmVersion: 'map-match-dev-v1',
  coveragePolicyVersion: 1,
};
const reconciliationPolicy: ReconciliationPolicy = { ...policy, maximumGpsAccuracyMetres: 20, maximumContinuityGapSeconds: 120 };

function segment(id: string, projectId = 'project-a'): ProjectStreetSegment {
  return {
    id,
    workspaceId: 'workspace-a',
    projectId,
    streetSegmentId: `street-${id}`,
    eligible: true,
    lengthMetres: 100,
    geometry: [{ latitude: -26.2, longitude: 27.8 }, { latitude: -26.201, longitude: 27.801 }],
    source: { provider: 'test', sourceId: id, sourceVersion: '1' },
  };
}

function candidate(id: string, overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    projectStreetSegment: segment(id),
    lateralDistanceMetres: 4,
    headingDeltaDegrees: 3,
    continuityScore: 0.96,
    startOffsetMetres: 0,
    endOffsetMetres: 90,
    continuesFromPrevious: true,
    ...overrides,
  };
}

test('a clear eligible street produces a matched outcome and contribution', () => {
  const outcome = resolveMapMatch({ workspaceId: 'workspace-a', projectId: 'project-a', candidates: [candidate('main')], policy });
  assert.equal(outcome.status, 'MATCHED');
  const contribution = contributionFromMatch({ outcome, projectId: 'project-a', searchSessionId: 'session-a', userId: 'capturer-a', evidenceId: 'evidence-a', policy });
  assert.equal(contribution?.projectStreetSegmentId, 'main');
  assert.equal(contribution?.endOffsetMetres, 90);
});

test('cross-project and ineligible candidates never match', () => {
  const crossProject = candidate('foreign', { projectStreetSegment: segment('foreign', 'project-b') });
  const ineligibleSegment = { ...segment('closed'), eligible: false };
  const outcome = resolveMapMatch({ workspaceId: 'workspace-a', projectId: 'project-a', candidates: [crossProject, candidate('closed', { projectStreetSegment: ineligibleSegment })], policy });
  assert.equal(outcome.status, 'NO_MATCH');
});

test('similar parallel streets remain ambiguous and contribute zero coverage', () => {
  const outcome = resolveMapMatch({
    workspaceId: 'workspace-a',
    projectId: 'project-a',
    candidates: [candidate('left'), candidate('right', { lateralDistanceMetres: 5, headingDeltaDegrees: 4, continuityScore: 0.95 })],
    policy,
  });
  assert.equal(outcome.status, 'AMBIGUOUS');
  assert.equal(contributionFromMatch({ outcome, projectId: 'project-a', searchSessionId: 'session-a', userId: 'capturer-a', evidenceId: 'evidence-a', policy }), null);
});

test('a side street with incompatible heading and sequence is rejected', () => {
  const outcome = resolveMapMatch({
    workspaceId: 'workspace-a',
    projectId: 'project-a',
    previousProjectStreetSegmentId: 'main',
    candidates: [candidate('side', { headingDeltaDegrees: 75, continuesFromPrevious: false })],
    policy,
  });
  assert.equal(outcome.status, 'NO_MATCH');
});

test('overlapping contributions from two capturers count only unique street metres', () => {
  const contributions: CoverageContribution[] = [
    { projectId: 'project-a', projectStreetSegmentId: 'shared', searchSessionId: 'session-a', userId: 'capturer-a', evidenceId: 'a', startOffsetMetres: 0, endOffsetMetres: 70, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1 },
    { projectId: 'project-a', projectStreetSegmentId: 'shared', searchSessionId: 'session-b', userId: 'capturer-b', evidenceId: 'b', startOffsetMetres: 40, endOffsetMetres: 100, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1 },
  ];
  assert.equal(uniqueCoveredMetres(segment('shared'), contributions), 100);
  const view = buildProjectStreetCoverageView({ segment: segment('shared'), contributions, policy });
  assert.equal(view.coverageState, 'COVERED');
  assert.equal(view.coverageColour, 'green');
  assert.equal('userId' in view, false);
});

test('complementary walks from two capturers complete one shared project street', () => {
  const target = segment('shared-complementary');
  const contributions: CoverageContribution[] = [
    { projectId: target.projectId, projectStreetSegmentId: target.id, searchSessionId: 'session-a', userId: 'capturer-a', evidenceId: 'first-half', startOffsetMetres: 0, endOffsetMetres: 45, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1, geometryVersion: '1' },
    { projectId: target.projectId, projectStreetSegmentId: target.id, searchSessionId: 'session-b', userId: 'capturer-b', evidenceId: 'second-half', startOffsetMetres: 45, endOffsetMetres: 100, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1, geometryVersion: '1' },
  ];
  const view = buildProjectStreetCoverageView({ segment: target, contributions, policy });
  assert.equal(view.coveredMetres, 100);
  assert.equal(view.coverageState, 'COVERED');
  assert.deepEqual(view.coverageSlices.map((slice) => [slice.colour, slice.startOffsetMetres, slice.endOffsetMetres]), [['green', 0, 100]]);
});

test('walking a street in reverse produces the same normalised contribution', () => {
  const outcome = resolveMapMatch({
    workspaceId: 'workspace-a', projectId: 'project-a',
    candidates: [candidate('reverse', { startOffsetMetres: 85, endOffsetMetres: 15 })], policy,
  });
  const contribution = contributionFromMatch({ outcome, projectId: 'project-a', searchSessionId: 'reverse-session', userId: 'capturer-a', evidenceId: 'reverse-evidence', policy });
  assert.equal(contribution?.startOffsetMetres, 15);
  assert.equal(contribution?.endOffsetMetres, 85);
});

test('foreign-project contributions cannot paint an assigned project street', () => {
  const target = segment('project-boundary');
  const foreign: CoverageContribution = {
    projectId: 'project-b', projectStreetSegmentId: target.id, searchSessionId: 'foreign-session', userId: 'capturer-b', evidenceId: 'foreign',
    startOffsetMetres: 0, endOffsetMetres: 100, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1, geometryVersion: '1',
  };
  const view = buildProjectStreetCoverageView({ segment: target, contributions: [foreign], policy });
  assert.equal(view.coveredMetres, 0);
  assert.equal(view.coverageState, 'UNCOVERED');
  assert.deepEqual(view.coverageSlices.map((slice) => slice.colour), ['red']);
});

test('project street rendering uses red, amber and green server-derived states', () => {
  const target = segment('colour');
  const contribution = (endOffsetMetres: number): CoverageContribution => ({
    projectId: 'project-a', projectStreetSegmentId: 'colour', searchSessionId: 'session-a', userId: 'capturer-a', evidenceId: String(endOffsetMetres),
    startOffsetMetres: 0, endOffsetMetres, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1,
  });
  assert.equal(buildProjectStreetCoverageView({ segment: target, contributions: [], policy }).coverageColour, 'red');
  assert.equal(buildProjectStreetCoverageView({ segment: target, contributions: [contribution(40)], policy }).coverageColour, 'amber');
  assert.equal(buildProjectStreetCoverageView({ segment: target, contributions: [contribution(10)], policy }).coverageState, 'PARTIALLY_COVERED');
  assert.equal(buildProjectStreetCoverageView({ segment: target, contributions: [contribution(90)], policy }).coverageColour, 'green');
  assert.equal(buildProjectStreetCoverageView({ segment: target, contributions: [contribution(90)], policy, verified: true }).coverageState, 'VERIFIED');
});

test('partial coverage renders confirmed green geometry and outstanding red geometry', () => {
  const curved = {
    ...segment('partial-render'),
    geometry: [
      { latitude: -26.2, longitude: 27.8 },
      { latitude: -26.2, longitude: 27.801 },
      { latitude: -26.201, longitude: 27.001 + 26.8 },
    ],
  };
  const contributions: CoverageContribution[] = [{
    projectId: 'project-a', projectStreetSegmentId: curved.id, searchSessionId: 'session-a', userId: 'capturer-a', evidenceId: 'partial',
    startOffsetMetres: 0, endOffsetMetres: 40, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1, geometryVersion: '1',
  }];
  const slices = buildStreetCoverageSlices(curved, contributions);
  assert.deepEqual(slices.map((slice) => [slice.colour, slice.startOffsetMetres, slice.endOffsetMetres]), [
    ['green', 0, 40],
    ['red', 40, 100],
  ]);
  assert.ok(slices.every((slice) => slice.geometry.length >= 2));
});

test('disconnected confirmed intervals retain red gaps and never double count', () => {
  const target = segment('gapped');
  const contributions: CoverageContribution[] = [
    { projectId: 'project-a', projectStreetSegmentId: target.id, searchSessionId: 'a', userId: 'one', evidenceId: 'a', startOffsetMetres: 0, endOffsetMetres: 20, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1, geometryVersion: '1' },
    { projectId: 'project-a', projectStreetSegmentId: target.id, searchSessionId: 'b', userId: 'two', evidenceId: 'b', startOffsetMetres: 60, endOffsetMetres: 80, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1, geometryVersion: '1' },
  ];
  assert.deepEqual(buildStreetCoverageSlices(target, contributions).map((slice) => slice.colour), ['green', 'red', 'green', 'red']);
  assert.equal(uniqueCoveredMetres(target, contributions), 40);
});

test('geometry slicing preserves intermediate road vertices', () => {
  const curved = {
    ...segment('curve'),
    geometry: [
      { latitude: -26.2, longitude: 27.8 },
      { latitude: -26.2, longitude: 27.801 },
      { latitude: -26.201, longitude: 27.801 },
    ],
  };
  const sliced = sliceStreetGeometry(curved, 20, 80);
  assert.ok(sliced.length >= 3);
  assert.ok(sliced.some((point) => point.latitude === -26.2 && point.longitude === 27.801));
});

test('contributions from incompatible geometry versions paint nothing', () => {
  const target = segment('geometry-version');
  const stale: CoverageContribution = {
    projectId: 'project-a', projectStreetSegmentId: target.id, searchSessionId: 'old', userId: 'one', evidenceId: 'old',
    startOffsetMetres: 0, endOffsetMetres: 100, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1, geometryVersion: 'old-geometry',
  };
  const view = buildProjectStreetCoverageView({ segment: target, contributions: [stale], policy });
  assert.equal(view.coveredMetres, 0);
  assert.deepEqual(view.coverageSlices.map((slice) => slice.colour), ['red']);
});

test('stale algorithm contributions do not paint the current coverage view', () => {
  const stale: CoverageContribution = {
    projectId: 'project-a', projectStreetSegmentId: 'versioned', searchSessionId: 'session-a', userId: 'capturer-a', evidenceId: 'old',
    startOffsetMetres: 0, endOffsetMetres: 100, algorithmVersion: 'map-match-old', coveragePolicyVersion: 1,
  };
  const view = buildProjectStreetCoverageView({ segment: segment('versioned'), contributions: [stale], policy });
  assert.equal(view.coverageState, 'UNCOVERED');
  assert.equal(view.coveredMetres, 0);
});

test('GIS candidate generation selects a clear nearby street', () => {
  const clear = { ...segment('clear'), geometry: [{ latitude: -26.2, longitude: 27.8 }, { latitude: -26.2, longitude: 27.802 }] };
  const traversal = { id: 'traversal-clear', from: { latitude: -26.20001, longitude: 27.8002 }, to: { latitude: -26.20001, longitude: 27.8018 }, fromEvidenceId: 'point-1', toEvidenceId: 'point-2' };
  const candidates = generateMapMatchCandidates({ traversal, projectStreetSegments: [clear] });
  const outcome = resolveMapMatch({ workspaceId: 'workspace-a', projectId: 'project-a', candidates, policy });
  assert.equal(outcome.status, 'MATCHED');
  assert.ok(candidates[0] && candidates[0].lateralDistanceMetres < 2);
});

test('GIS candidate generation keeps parallel streets visible to ambiguity handling', () => {
  const north = { ...segment('north'), geometry: [{ latitude: -26.2, longitude: 27.8 }, { latitude: -26.2, longitude: 27.802 }] };
  const south = { ...segment('south'), geometry: [{ latitude: -26.2001, longitude: 27.8 }, { latitude: -26.2001, longitude: 27.802 }] };
  const traversal = { id: 'traversal-between', from: { latitude: -26.20005, longitude: 27.8002 }, to: { latitude: -26.20005, longitude: 27.8018 }, fromEvidenceId: 'point-1', toEvidenceId: 'point-2' };
  const candidates = generateMapMatchCandidates({ traversal, projectStreetSegments: [north, south] });
  const outcome = resolveMapMatch({ workspaceId: 'workspace-a', projectId: 'project-a', candidates, policy });
  assert.equal(candidates.length, 2);
  assert.equal(outcome.status, 'AMBIGUOUS');
});

test('GIS candidate generation exposes a perpendicular side street but resolver rejects it', () => {
  const side = { ...segment('side-generated'), geometry: [{ latitude: -26.201, longitude: 27.801 }, { latitude: -26.199, longitude: 27.801 }] };
  const traversal = { id: 'traversal-east', from: { latitude: -26.2, longitude: 27.8002 }, to: { latitude: -26.2, longitude: 27.8018 }, fromEvidenceId: 'point-1', toEvidenceId: 'point-2' };
  const candidates = generateMapMatchCandidates({ traversal, projectStreetSegments: [side] });
  assert.equal(candidates.length, 1);
  assert.ok(candidates[0] && candidates[0].headingDeltaDegrees > 80);
  assert.equal(resolveMapMatch({ workspaceId: 'workspace-a', projectId: 'project-a', candidates, policy }).status, 'NO_MATCH');
});

test('persistable evidence retains all candidates and an ambiguous outcome', () => {
  const traversal = { id: 'traversal-audit', from: { latitude: -26.2, longitude: 27.8 }, to: { latitude: -26.2, longitude: 27.801 }, fromEvidenceId: 'point-1', toEvidenceId: 'point-2' };
  const candidates = [candidate('audit-left'), candidate('audit-right', { lateralDistanceMetres: 5 })];
  const outcome = resolveMapMatch({ workspaceId: 'workspace-a', projectId: 'project-a', candidates, policy });
  const evidence = buildMapMatchEvidence({ id: 'match-evidence-a', workspaceId: 'workspace-a', projectId: 'project-a', searchSessionId: 'session-a', traversal, candidates, outcome, policy, createdAt: '2026-09-16T08:00:00.000Z' });
  assert.equal(evidence.outcome, 'AMBIGUOUS');
  assert.equal(evidence.candidates.length, 2);
  assert.equal(evidence.selectedProjectStreetSegmentId, null);
  assert.deepEqual(evidence.sourceEvidenceIds, ['point-1', 'point-2']);
});

test('reconciliation skips a continuity gap before map matching', () => {
  const decision = reconcileMapMatch({
    workspaceId: 'workspace-a', projectId: 'project-a', searchSessionId: 'session-a', userId: 'capturer-a', projectStreetSegments: [segment('gap')], policy: reconciliationPolicy, createdAt: '2026-09-16T08:15:00.000Z',
    from: { id: 'point-1', capturedAt: '2026-09-16T08:00:00.000Z', latitude: -26.2, longitude: 27.8, accuracyMetres: 5, validationStatus: 'ACCEPTED' },
    to: { id: 'point-2', capturedAt: '2026-09-16T08:10:00.000Z', latitude: -26.2, longitude: 27.801, accuracyMetres: 5, validationStatus: 'ACCEPTED' },
  });
  assert.equal(decision.status, 'SKIPPED_UNSUPPORTED_TRAVERSAL');
  assert.equal('evidence' in decision, false);
});

test('reconciliation creates deterministic evidence and contribution only for a match', () => {
  const road = { ...segment('transactional'), geometry: [{ latitude: -26.2, longitude: 27.8 }, { latitude: -26.2, longitude: 27.802 }] };
  const input = {
    workspaceId: 'workspace-a', projectId: 'project-a', searchSessionId: 'session-a', userId: 'capturer-a', projectStreetSegments: [road], policy: reconciliationPolicy, createdAt: '2026-09-16T08:01:00.000Z',
    from: { id: 'point-1', capturedAt: '2026-09-16T08:00:00.000Z', latitude: -26.20001, longitude: 27.8002, accuracyMetres: 5, validationStatus: 'ACCEPTED' as const },
    to: { id: 'point-2', capturedAt: '2026-09-16T08:01:00.000Z', latitude: -26.20001, longitude: 27.8018, accuracyMetres: 5, validationStatus: 'ACCEPTED' as const },
  };
  const first = reconcileMapMatch(input);
  const second = reconcileMapMatch(input);
  assert.equal(first.status, 'MATCHED');
  assert.equal(second.status, 'MATCHED');
  if (first.status !== 'MATCHED' || second.status !== 'MATCHED') assert.fail('Expected a match.');
  assert.equal(first.evidence.id, 'mme_ct_point-1_point-2');
  assert.equal(second.evidence.id, first.evidence.id);
  assert.equal(first.contribution?.projectStreetSegmentId, 'transactional');
});

test('reconciliation persists ambiguous evidence but creates no contribution', () => {
  const left = { ...segment('persist-left'), geometry: [{ latitude: -26.2, longitude: 27.8 }, { latitude: -26.2, longitude: 27.802 }] };
  const right = { ...segment('persist-right'), geometry: [{ latitude: -26.2001, longitude: 27.8 }, { latitude: -26.2001, longitude: 27.802 }] };
  const decision = reconcileMapMatch({
    workspaceId: 'workspace-a', projectId: 'project-a', searchSessionId: 'session-a', userId: 'capturer-a', projectStreetSegments: [left, right], policy: reconciliationPolicy, createdAt: '2026-09-16T08:01:00.000Z',
    from: { id: 'point-1', capturedAt: '2026-09-16T08:00:00.000Z', latitude: -26.20005, longitude: 27.8002, accuracyMetres: 5, validationStatus: 'ACCEPTED' },
    to: { id: 'point-2', capturedAt: '2026-09-16T08:01:00.000Z', latitude: -26.20005, longitude: 27.8018, accuracyMetres: 5, validationStatus: 'ACCEPTED' },
  });
  assert.equal(decision.status, 'AMBIGUOUS');
  if (decision.status !== 'AMBIGUOUS') assert.fail('Expected ambiguity.');
  assert.equal(decision.evidence.outcome, 'AMBIGUOUS');
  assert.equal(decision.contribution, null);
});

test('orchestration continues from the matched segment ending at the previous movement point', () => {
  const selected = findPreviousMatchedSegment([
    { data: { workspaceId: 'workspace-a', projectId: 'project-a', outcome: 'AMBIGUOUS', sourceEvidenceIds: ['point-0', 'point-1'], selectedProjectStreetSegmentId: null, createdAt: '2026-09-16T08:00:00.000Z' } },
    { data: { workspaceId: 'workspace-a', projectId: 'project-a', outcome: 'MATCHED', sourceEvidenceIds: ['point-0', 'point-1'], selectedProjectStreetSegmentId: 'segment-a', createdAt: '2026-09-16T08:01:00.000Z' } },
    { data: { workspaceId: 'workspace-b', projectId: 'project-a', outcome: 'MATCHED', sourceEvidenceIds: ['point-0', 'point-1'], selectedProjectStreetSegmentId: 'foreign-segment', createdAt: '2026-09-16T08:02:00.000Z' } },
  ], { workspaceId: 'workspace-a', projectId: 'project-a', fromEvidenceId: 'point-1' });
  assert.equal(selected, 'segment-a');
});

test('project street parsing preserves explicit topology for sequence continuity', () => {
  const parsed = parseProjectStreetSegment('segment-a', {
    workspaceId: 'workspace-a', projectId: 'project-a', streetSegmentId: 'street-a', eligible: true, lengthMetres: 100,
    geometry: [{ latitude: -26.2, longitude: 27.8 }, { latitude: -26.2, longitude: 27.801 }],
    source: { provider: 'test', sourceId: 'street-a', sourceVersion: '1' },
    connectedProjectStreetSegmentIds: ['segment-b', 'segment-c', 42],
  });
  assert.deepEqual(parsed.connectedProjectStreetSegmentIds, ['segment-b', 'segment-c']);
});
