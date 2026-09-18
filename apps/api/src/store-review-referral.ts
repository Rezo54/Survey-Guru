import type { Firestore, DocumentReference } from 'firebase-admin/firestore';

/** Flag and audit commit together; a retry cannot duplicate the referral event. */
export async function persistStoreReferral(firestore: Firestore, capture: DocumentReference, input: { workspaceId: string; actorId: string; reason: string; now: string }) {
  const event = firestore.collection('storeCaptureQaEvents').doc();
  await firestore.runTransaction(async transaction => {
    const current = await transaction.get(capture);
    if (!current.exists || current.get('workspaceId') !== input.workspaceId) throw new Error('Store is outside your workspace.');
    const status = current.get('status');
    if (!['VERIFIED', 'READY_FOR_EXPORT', 'SYNCED'].includes(status)) throw new Error('Only an accepted store can be referred from the map.');
    if (current.get('qaReviewRequested') === true) return;
    transaction.update(current.ref, { qaReviewRequested: true, qaReviewReason: input.reason, qaReviewRequestedAt: input.now, qaReviewRequestedBy: input.actorId, preQaStatus: status, updatedAt: input.now });
    transaction.create(event, { workspaceId: input.workspaceId, projectId: current.get('projectId'), storeCaptureId: current.id, reviewerUserId: input.actorId, decision: 'FLAG_FOR_REVIEW', reason: input.reason, fromStatus: status, toStatus: status, transitions: [], decidedAt: input.now });
  });
}
