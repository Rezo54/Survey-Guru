export type StoreCaptureStatus = 'DRAFT' | 'SUBMITTED' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED' | 'READY_FOR_EXPORT' | 'SYNCED';
export type StoreDataRights = 'TASKRAFT_LICENSED_LEGACY' | 'TES_NEW_CAPTURE';
export type StoreQaDecision = 'VERIFY' | 'VERIFY_AND_READY' | 'RETURN_FOR_CORRECTION' | 'REJECT' | 'MARK_READY_FOR_EXPORT';

export type StoreQaResolution = Readonly<{
  finalStatus: StoreCaptureStatus;
  transitions: readonly Readonly<{ from: StoreCaptureStatus; to: StoreCaptureStatus }>[];
  requiresReason: boolean;
}>;

export type StoreAutomatedQaPolicy = Readonly<{
  autoVerifyEnabled: boolean;
  manualApprovalBeforeExport: boolean;
  maximumGpsAccuracyMetres: number;
  minimumPhotoCount: number;
}>;

export type StoreAutomatedQaAssessment = Readonly<{
  outcome: 'AUTO_VERIFIED' | 'MANUAL_REVIEW';
  recommendedStatus: 'VERIFIED' | 'SUBMITTED';
  manualApprovalBeforeExport: boolean;
  checks: readonly Readonly<{ key: 'QUESTIONNAIRE' | 'PHOTO_INTEGRITY' | 'GPS_ACCURACY' | 'IDENTITY'; passed: boolean; message: string }>[];
}>;

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

export type StoreCapturePreflightReason = Readonly<{
  key: 'GPS_ACCURACY' | 'PROJECT_BOUNDARY' | 'IDENTITY';
  message: string;
}>;

export type StoreCapturePreflightResult = Readonly<{
  allowed: boolean;
  reasons: readonly StoreCapturePreflightReason[];
  identityCandidates: readonly StoreMatchCandidate[];
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

export function pointIsInsideProjectBoundary(location: StoreLocation, boundary: readonly StoreLocation[]): boolean {
  if (!finiteCoordinate(location) || boundary.length < 3 || boundary.some((point) => !finiteCoordinate(point))) return false;
  let inside = false;
  for (let current = 0, previous = boundary.length - 1; current < boundary.length; previous = current, current += 1) {
    const a = boundary[current];
    const b = boundary[previous];
    if (!a || !b) continue;
    const crossesLatitude = (a.latitude > location.latitude) !== (b.latitude > location.latitude);
    const longitudeAtLatitude = (b.longitude - a.longitude) * (location.latitude - a.latitude)
      / (b.latitude - a.latitude) + a.longitude;
    if (crossesLatitude && location.longitude < longitudeAtLatitude) inside = !inside;
  }
  return inside;
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

export function evaluateStoreCapturePreflight(input: Readonly<{
  location: StoreLocation;
  projectBoundary: readonly StoreLocation[];
  maximumGpsAccuracyMetres: number;
  identityCandidates: readonly StoreMatchCandidate[];
  selectedExistingStoreId?: string;
}>): StoreCapturePreflightResult {
  const reasons: StoreCapturePreflightReason[] = [];
  if (typeof input.location.accuracyMetres !== 'number' || input.location.accuracyMetres > input.maximumGpsAccuracyMetres) {
    reasons.push({
      key: 'GPS_ACCURACY',
      message: `GPS accuracy must be ${input.maximumGpsAccuracyMetres} metres or better before store capture can begin.`,
    });
  }
  if (!pointIsInsideProjectBoundary(input.location, input.projectBoundary)) {
    reasons.push({ key: 'PROJECT_BOUNDARY', message: 'This location is outside the assigned project area.' });
  }
  if (input.identityCandidates.length > 0
    && (!input.selectedExistingStoreId || !input.identityCandidates.some((candidate) => candidate.storeId === input.selectedExistingStoreId))) {
    reasons.push({
      key: 'IDENTITY',
      message: 'A store already exists at or near this location. Select the matching store before continuing.',
    });
  }
  return { allowed: reasons.length === 0, reasons, identityCandidates: input.identityCandidates };
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

export function resolveStoreQaDecision(from: StoreCaptureStatus, decision: StoreQaDecision): StoreQaResolution {
  if (decision === 'VERIFY' && (from === 'SUBMITTED' || from === 'NEEDS_REVIEW')) {
    return { finalStatus: 'VERIFIED', transitions: [{ from, to: 'VERIFIED' }], requiresReason: false };
  }
  if (decision === 'VERIFY_AND_READY' && (from === 'SUBMITTED' || from === 'NEEDS_REVIEW')) {
    return {
      finalStatus: 'READY_FOR_EXPORT',
      transitions: [{ from, to: 'VERIFIED' }, { from: 'VERIFIED', to: 'READY_FOR_EXPORT' }],
      requiresReason: false,
    };
  }
  if (decision === 'RETURN_FOR_CORRECTION' && (from === 'SUBMITTED' || from === 'VERIFIED' || from === 'READY_FOR_EXPORT')) {
    return { finalStatus: 'NEEDS_REVIEW', transitions: [{ from, to: 'NEEDS_REVIEW' }], requiresReason: true };
  }
  if (decision === 'REJECT' && (from === 'SUBMITTED' || from === 'NEEDS_REVIEW')) {
    return { finalStatus: 'REJECTED', transitions: [{ from, to: 'REJECTED' }], requiresReason: true };
  }
  if (decision === 'MARK_READY_FOR_EXPORT' && from === 'VERIFIED') {
    return { finalStatus: 'READY_FOR_EXPORT', transitions: [{ from, to: 'READY_FOR_EXPORT' }], requiresReason: false };
  }
  throw new Error(`QA decision ${decision} is not permitted from ${from}.`);
}

export function evaluateAutomatedStoreQa(input: Readonly<{
  draft: StoreCaptureDraft;
  requiredQuestionIds: readonly string[];
  storedPhotoIntegrityVerified: boolean;
  identityCandidates: readonly StoreMatchCandidate[];
  policy: StoreAutomatedQaPolicy;
}>): StoreAutomatedQaAssessment {
  const questionnaireIssues = validateStoreCaptureSubmission(input.draft, input.requiredQuestionIds)
    .filter((issue) => issue.startsWith('Question ') || issue.includes('Store name'));
  const identityResolved = input.identityCandidates.length === 0
    || (typeof input.draft.selectedExistingStoreId === 'string'
      && input.identityCandidates.some((candidate) => candidate.storeId === input.draft.selectedExistingStoreId));
  const checks: StoreAutomatedQaAssessment['checks'] = [
    { key: 'QUESTIONNAIRE', passed: questionnaireIssues.length === 0, message: questionnaireIssues[0] ?? 'Required questionnaire answers are complete.' },
    {
      key: 'PHOTO_INTEGRITY',
      passed: input.storedPhotoIntegrityVerified && input.draft.photos.length >= input.policy.minimumPhotoCount,
      message: input.storedPhotoIntegrityVerified && input.draft.photos.length >= input.policy.minimumPhotoCount
        ? 'Required photo evidence passed server-side integrity verification.'
        : 'Photo evidence needs human review.',
    },
    {
      key: 'GPS_ACCURACY',
      passed: typeof input.draft.location.accuracyMetres === 'number' && input.draft.location.accuracyMetres <= input.policy.maximumGpsAccuracyMetres,
      message: typeof input.draft.location.accuracyMetres === 'number' && input.draft.location.accuracyMetres <= input.policy.maximumGpsAccuracyMetres
        ? `GPS accuracy is within ${input.policy.maximumGpsAccuracyMetres} metres.`
        : `GPS accuracy is weaker than the ${input.policy.maximumGpsAccuracyMetres} metre automated threshold.`,
    },
    {
      key: 'IDENTITY',
      passed: identityResolved,
      message: identityResolved ? 'No unresolved nearby-store identity risk remains.' : 'A nearby store or changed trading name requires human identity review.',
    },
  ];
  const autoVerified = input.policy.autoVerifyEnabled && checks.every((check) => check.passed);
  return {
    outcome: autoVerified ? 'AUTO_VERIFIED' : 'MANUAL_REVIEW',
    recommendedStatus: autoVerified ? 'VERIFIED' : 'SUBMITTED',
    manualApprovalBeforeExport: input.policy.manualApprovalBeforeExport,
    checks,
  };
}

export function classifyStoreDataRights(input: Readonly<{ sourceSnapshotId?: string; licenceScheduleId?: string }>): StoreDataRights {
  const hasSnapshot = Boolean(input.sourceSnapshotId);
  const hasLicence = Boolean(input.licenceScheduleId);
  if (hasSnapshot !== hasLicence) throw new Error('Legacy Taskraft stores require both an immutable source snapshot and licence schedule.');
  return hasSnapshot ? 'TASKRAFT_LICENSED_LEGACY' : 'TES_NEW_CAPTURE';
}
