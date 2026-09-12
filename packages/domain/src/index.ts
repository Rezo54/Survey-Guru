export type SearchSessionState = 'READY' | 'ACTIVE_SEARCH' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export type CoverageState = 'UNCOVERED' | 'PARTIALLY_COVERED' | 'COVERED' | 'VERIFIED';

export interface SearchSession {
  id: string;
  assignmentId: string;
  state: SearchSessionState;
  startedAt?: string;
  completedAt?: string;
}

export interface MovementEvent {
  id: string;
  searchSessionId: string;
  sequenceNumber: number;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMetres: number;
}

export interface MovementBatch {
  id: string;
  searchSessionId: string;
  idempotencyKey: string;
  firstSequence: number;
  lastSequence: number;
  events: MovementEvent[];
}
