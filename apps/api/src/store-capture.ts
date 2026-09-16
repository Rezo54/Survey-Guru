export type StoreCaptureStatus = 'DRAFT' | 'SUBMITTED' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED' | 'READY_FOR_EXPORT' | 'SYNCED';
export type StoreDataRights = 'TASKRAFT_LICENSED_LEGACY' | 'TES_NEW_CAPTURE';

export type StoreLocation = Readonly<{ latitude: number; longitude: number; accuracyMetres?: number }>;
export type StoreIdentity = Readonly<{
  id: string;
  workspaceId: string;
  canonicalName: string;
  aliases?: readonly string[];
  location: StoreLocation;
  dataRights: StoreDataRights;
  sourceSnapshotId?: string;
  licenceScheduleId?: string;
}>;

export type StorePhotoEvidence = Readonly<{
  storageObjectPath: string;
  sha256: string;
  capturedAt: string;
}>;

export type StoreCaptureDraft = Readonly<{
  id: string;
  workspaceId: string;
  projectId: string;
  assignmentId: string;
  capturerUserId: string;
  observedName: string;
  location: StoreLocation;
  selectedExistingStoreId?: string;
  answers: Readonly<Record<string, unknown>>;
  photos: readonly StorePhotoEvidence[];
  status: StoreCaptureStatus;
}>;

export type StoreMatchCandidate = Readonly<{
  storeId: string;
  canonicalName: string;
  distanceMetres: number;
  nameSimilarity: number;
  reason: 'SAME_LOCATION_NAME_MATCH' | 'SAME_LOCATION_NAME_CHANGED' | 'NEARBY_POSSIBLE_DUPLICATE';
}>;

const transitionTargets: Readonly<Record<StoreCaptureStatus, readonly StoreCaptureStatus[]>> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['NEEDS_REVIEW', 'VERIFIED', 'REJECTED'],
  NEEDS_REVIEW: ['SUBMITTED', 'VERIFIED', 'REJECTED'],
  VERIFIED: ['READY_FOR_EXPORT', 'NEEDS_REVIEW'],
  REJECTED: ['DRAFT'],
  READY_FOR_EXPORT: ['SYNCED', 'NEEDS_REVIEW'],
  SYNCED: [],
};

function finiteCoordinate(location: StoreLocation): boolean {
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    && location.latitude >= -90 && location.latitude <= 90
    && location.longitude >= -180 && location.longitude <= 180;
}

function distanceMetres(left: StoreLocation, right: StoreLocation): number {
  const earthRadiusMetres = 6_371_000;
  const latitudeDelta = (right.latitude - left.latitude) * Math.PI / 180;
  const longitudeDelta = (right.longitude - left.longitude) * Math.PI / 180;
  const leftLatitude = left.latitude * Math.PI / 180;
  const rightLatitude = right.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMetres * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function nameTokens(value: string): ReadonlySet<string> {
  return new Set(value.toLocaleLowerCase('en-ZA').normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean));
}

function nameSimilarity(left: string, right: string): number {
  const a = nameTokens(left);
  const b = nameTokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return Number((intersection / union).toFixed(3));
}

export function findStoreIdentityCandidates(input: Readonly<{
  workspaceId: string;
  observedName: string;
  location: StoreLocation;
  stores: readonly StoreIdentity[];
  maximumDistanceMetres?: number;
  sameLocationMetres?: number;
}>): readonly StoreMatchCandidate[] {
  if (!finiteCoordinate(input.location)) throw new Error('A valid store location is required.');
  const maximumDistance = input.maximumDistanceMetres ?? 60;
  const sameLocation = input.sameLocationMetres ?? 20;
  return input.stores
    .filter((store) => store.workspaceId === input.workspaceId && finiteCoordinate(store.location))
    .map((store) => {
      const distance = distanceMetres(input.location, store.location);
      const similarity = Math.max(nameSimilarity(input.observedName, store.canonicalName), ...(store.aliases ?? []).map((alias) => nameSimilarity(input.observedName, alias)));
      const reason: StoreMatchCandidate['reason'] = distance <= sameLocation
        ? similarity >= 0.5 ? 'SAME_LOCATION_NAME_MATCH' : 'SAME_LOCATION_NAME_CHANGED'
        : 'NEARBY_POSSIBLE_DUPLICATE';
      return { storeId: store.id, canonicalName: store.canonicalName, distanceMetres: Number(distance.toFixed(1)), nameSimilarity: similarity, reason };
    })
    .filter((candidate) => candidate.distanceMetres <= maximumDistance)
    .sort((left, right) => left.distanceMetres - right.distanceMetres || right.nameSimilarity - left.nameSimilarity);
}

export function validateStoreCaptureSubmission(draft: StoreCaptureDraft, requiredQuestionIds: readonly string[]): readonly string[] {
  const issues: string[] = [];
  if (draft.status !== 'DRAFT' && draft.status !== 'NEEDS_REVIEW') issues.push('Only a draft or returned capture can be submitted.');
  if (!draft.workspaceId || !draft.projectId || !draft.assignmentId || !draft.capturerUserId) issues.push('Authorised project assignment context is required.');
  if (!draft.observedName.trim()) issues.push('Store name is required.');
  if (!finiteCoordinate(draft.location)) issues.push('A valid store location is required.');
  if (draft.photos.length === 0 || draft.photos.some((photo) => !photo.storageObjectPath || !/^[a-f0-9]{64}$/i.test(photo.sha256))) issues.push('At least one integrity-checked store photo is required.');
  for (const questionId of requiredQuestionIds) {
    const answer = draft.answers[questionId];
    if (answer === undefined || answer === null || answer === '') issues.push(`Question ${questionId} requires an answer.`);
  }
  return issues;
}

export function canTransitionStoreCapture(from: StoreCaptureStatus, to: StoreCaptureStatus): boolean {
  return transitionTargets[from].includes(to);
}

export function canPublishStoreCaptureToThirdParty(status: StoreCaptureStatus): boolean {
  return status === 'READY_FOR_EXPORT' || status === 'SYNCED';
}

export function classifyStoreDataRights(input: Readonly<{ sourceSnapshotId?: string; licenceScheduleId?: string }>): StoreDataRights {
  const hasSnapshot = Boolean(input.sourceSnapshotId);
  const hasLicence = Boolean(input.licenceScheduleId);
  if (hasSnapshot !== hasLicence) throw new Error('Legacy Taskraft stores require both an immutable source snapshot and licence schedule.');
  return hasSnapshot ? 'TASKRAFT_LICENSED_LEGACY' : 'TES_NEW_CAPTURE';
}
