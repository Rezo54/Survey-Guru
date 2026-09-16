import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProjectStreetCoverageView,
  contributionFromMatch,
  resolveMapMatch,
  uniqueCoveredMetres,
  type CoverageContribution,
  type MatchCandidate,
  type MapMatchPolicy,
  type ProjectStreetSegment,
} from '../src/map-matching.js';

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

test('project street rendering uses red, amber and green server-derived states', () => {
  const target = segment('colour');
  const contribution = (endOffsetMetres: number): CoverageContribution => ({
    projectId: 'project-a', projectStreetSegmentId: 'colour', searchSessionId: 'session-a', userId: 'capturer-a', evidenceId: String(endOffsetMetres),
    startOffsetMetres: 0, endOffsetMetres, algorithmVersion: policy.algorithmVersion, coveragePolicyVersion: 1,
  });
  assert.equal(buildProjectStreetCoverageView({ segment: target, contributions: [], policy }).coverageColour, 'red');
  assert.equal(buildProjectStreetCoverageView({ segment: target, contributions: [contribution(40)], policy }).coverageColour, 'amber');
  assert.equal(buildProjectStreetCoverageView({ segment: target, contributions: [contribution(90)], policy }).coverageColour, 'green');
  assert.equal(buildProjectStreetCoverageView({ segment: target, contributions: [contribution(90)], policy, verified: true }).coverageState, 'VERIFIED');
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
