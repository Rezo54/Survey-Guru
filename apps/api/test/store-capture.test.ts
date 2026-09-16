import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPublishStoreCaptureToThirdParty,
  canTransitionStoreCapture,
  classifyStoreDataRights,
  findStoreIdentityCandidates,
  validateStoreCaptureSubmission,
  type StoreCaptureDraft,
  type StoreIdentity,
} from '../src/store-capture.js';

const existing: StoreIdentity[] = [{
  id: 'store-legacy-1', workspaceId: 'workspace-a', canonicalName: 'Zama Tuck Shop', aliases: ['Zama General Dealer'],
  location: { latitude: -26.2, longitude: 27.8 }, dataRights: 'TASKRAFT_LICENSED_LEGACY', sourceSnapshotId: 'snapshot-90000-v1', licenceScheduleId: 'taskraft-tes-licence-v1',
}];

function draft(overrides: Partial<StoreCaptureDraft> = {}): StoreCaptureDraft {
  return {
    id: 'capture-1', workspaceId: 'workspace-a', projectId: 'project-a', assignmentId: 'assignment-a', capturerUserId: 'capturer-a',
    observedName: 'Zama Market', location: { latitude: -26.2, longitude: 27.8, accuracyMetres: 5 },
    answers: { ownerName: 'Zama', stockedBrands: ['Brand A'], pricing: [{ product: 'Bread', price: 18.5 }] },
    photos: [{ storageObjectPath: 'workspaces/workspace-a/projects/project-a/captures/capture-1/storefront.jpg', sha256: 'a'.repeat(64), capturedAt: '2026-09-16T18:00:00.000Z' }],
    status: 'DRAFT', ...overrides,
  };
}

test('same location remains a store candidate when the trading name changed', () => {
  const candidates = findStoreIdentityCandidates({ workspaceId: 'workspace-a', observedName: 'New Owner Supermarket', location: { latitude: -26.20002, longitude: 27.80001 }, stores: existing });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.storeId, 'store-legacy-1');
  assert.equal(candidates[0]?.reason, 'SAME_LOCATION_NAME_CHANGED');
});

test('an alias can identify an existing store without changing its canonical identity', () => {
  const candidates = findStoreIdentityCandidates({ workspaceId: 'workspace-a', observedName: 'Zama General Dealer', location: { latitude: -26.2, longitude: 27.8 }, stores: existing });
  assert.equal(candidates[0]?.reason, 'SAME_LOCATION_NAME_MATCH');
  assert.equal(candidates[0]?.nameSimilarity, 1);
});

test('identity matching is workspace scoped and distance bounded', () => {
  assert.deepEqual(findStoreIdentityCandidates({ workspaceId: 'workspace-b', observedName: 'Zama Tuck Shop', location: { latitude: -26.2, longitude: 27.8 }, stores: existing }), []);
  assert.deepEqual(findStoreIdentityCandidates({ workspaceId: 'workspace-a', observedName: 'Zama Tuck Shop', location: { latitude: -27, longitude: 28 }, stores: existing }), []);
});

test('submission requires assignment context, questionnaire answers and photo integrity', () => {
  assert.deepEqual(validateStoreCaptureSubmission(draft(), ['ownerName', 'stockedBrands', 'pricing']), []);
  const invalid = draft({ observedName: '', photos: [], answers: {} });
  const issues = validateStoreCaptureSubmission(invalid, ['ownerName', 'stockedBrands']);
  assert.ok(issues.some((issue) => issue.includes('Store name')));
  assert.ok(issues.some((issue) => issue.includes('photo')));
  assert.ok(issues.some((issue) => issue.includes('ownerName')));
});

test('QA state machine prevents draft or unverified third-party publication', () => {
  assert.equal(canTransitionStoreCapture('DRAFT', 'SUBMITTED'), true);
  assert.equal(canTransitionStoreCapture('SUBMITTED', 'VERIFIED'), true);
  assert.equal(canTransitionStoreCapture('VERIFIED', 'READY_FOR_EXPORT'), true);
  assert.equal(canTransitionStoreCapture('DRAFT', 'READY_FOR_EXPORT'), false);
  assert.equal(canPublishStoreCaptureToThirdParty('VERIFIED'), false);
  assert.equal(canPublishStoreCaptureToThirdParty('READY_FOR_EXPORT'), true);
  assert.equal(canPublishStoreCaptureToThirdParty('SYNCED'), true);
});

test('historical Taskraft rights require an immutable snapshot and licence schedule', () => {
  assert.equal(classifyStoreDataRights({ sourceSnapshotId: 'snapshot-90000-v1', licenceScheduleId: 'taskraft-tes-licence-v1' }), 'TASKRAFT_LICENSED_LEGACY');
  assert.equal(classifyStoreDataRights({}), 'TES_NEW_CAPTURE');
  assert.throws(() => classifyStoreDataRights({ sourceSnapshotId: 'snapshot-without-licence' }), /licence schedule/);
});
