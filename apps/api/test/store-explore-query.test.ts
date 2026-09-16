import assert from 'node:assert/strict';
import test from 'node:test';
import { normaliseStoreExploreQuery } from '../src/store-explore-query.js';

test('explore queries default to every authorised project and normalise facets', () => {
  const query = normaliseStoreExploreQuery({
    workspaceId: ' workspace-a ', authorisedProjectIds: ['project-b', 'project-a'],
    teamMemberIds: ['capturer-a', 'capturer-a'], coverage: ['WALKED', 'NOT_WALKED'],
    text: '  Zama bread ', brands: [' Brand B ', 'Brand A'], productCategories: ['Staples'],
    minimumMonthlyVolume: 10, maximumMonthlyVolume: 100, minimumPrice: 5, maximumPrice: 25,
    statuses: ['VERIFIED', 'READY_FOR_EXPORT'], dataRights: ['TES_NEW_CAPTURE'],
  });
  assert.deepEqual(query.projectIds, ['project-a', 'project-b']);
  assert.deepEqual(query.teamMemberIds, ['capturer-a']);
  assert.deepEqual(query.brands, ['Brand A', 'Brand B']);
  assert.equal(query.text, 'Zama bread');
  assert.equal(query.pageSize, 100);
});

test('explore queries cannot escape authorised project scope', () => {
  assert.throws(() => normaliseStoreExploreQuery({
    workspaceId: 'workspace-a', authorisedProjectIds: ['project-a'], projectIds: ['project-b'],
  }), /access denied/);
});

test('explore query ranges and pagination are bounded', () => {
  assert.throws(() => normaliseStoreExploreQuery({ workspaceId: 'workspace-a', authorisedProjectIds: ['project-a'], minimumPrice: 20, maximumPrice: 10 }), /Minimum price/);
  assert.throws(() => normaliseStoreExploreQuery({ workspaceId: 'workspace-a', authorisedProjectIds: ['project-a'], pageSize: 501 }), /Page size/);
});

