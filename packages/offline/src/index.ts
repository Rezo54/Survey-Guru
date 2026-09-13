export type SyncState = 'LOCAL_ONLY' | 'QUEUED' | 'SYNCING' | 'SYNCED' | 'NEEDS_ATTENTION' | 'SUPERSEDED';

export interface OfflineRecordRef {
  id: string;
  type: string;
  syncState: SyncState;
  updatedAt: string;
}

export const offlineSafety = {
  serviceWorkerIsAuthority: false,
  cachedRolesAreTrusted: false,
  syncRequiresReauthorisation: true
} as const;
