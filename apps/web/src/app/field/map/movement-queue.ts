export type QueuedMovement = { eventId: string; ownerId: string; sessionId: string; capturedAt: string; latitude: number; longitude: number; accuracyMetres: number; source: 'pwa_foreground' | 'native_background'; blockedReason?: string };
export interface MovementStore {
  put(point: QueuedMovement): Promise<void>;
  list(ownerId: string, sessionId: string): Promise<QueuedMovement[]>;
  remove(eventId: string): Promise<void>;
}
export class SyncError extends Error { constructor(message: string, public readonly status: number) { super(message); } }

/** Never removes an unacknowledged point; retries retain the original identity and timestamp. */
export function createMovementQueue(options: {
  store: MovementStore; ownerId: string; sessionId: string;
  currentOwner: () => Promise<string>; online: () => boolean;
  send: (point: QueuedMovement, signal: AbortSignal) => Promise<void>;
  onStatus: (pending: number, message: string) => void;
}) {
  let disposed = false;
  let lastCount = 0;
  let flushing: Promise<void> | undefined;
  const controller = new AbortController();
  const list = () => options.store.list(options.ownerId, options.sessionId);
  async function report(message: string) { if (!disposed) { lastCount = (await list()).length; options.onStatus(lastCount, message); } }
  async function drain() {
    try {
      for (const point of await list()) {
        if (disposed || !options.online()) break;
        if (await options.currentOwner() !== options.ownerId) { await report('Sign back into the original account to sync saved locations.'); return; }
        if (point.blockedReason) { await report(point.blockedReason); return; }
        try { await options.send(point, controller.signal); }
        catch (error) {
          if (disposed) return;
          if (error instanceof SyncError && error.status === 422) {
            await options.store.put({ ...point, blockedReason: error.message });
          }
          await report(error instanceof SyncError && [401, 403, 422].includes(error.status)
            ? error.message : 'Locations saved on this device. Sync will retry when the connection recovers.');
          return;
        }
        await options.store.remove(point.eventId);
      }
      await report(options.online() ? 'Saved locations synchronised.' : 'Offline: locations are saved on this device.');
    } catch { if (!disposed) options.onStatus(lastCount, 'Device storage or sign-in is unavailable. Pending count may be outdated. Stop tracking and reopen the app; saved locations have not been discarded.'); }
  }
  function flush() {
    if (disposed) return Promise.resolve();
    if (!flushing) flushing = drain().finally(() => { flushing = undefined; });
    return flushing;
  }
  return {
    async enqueue(position: GeolocationPosition, source: QueuedMovement['source'] = 'pwa_foreground') {
      if (disposed) return;
      if (await options.currentOwner() !== options.ownerId) throw new Error('Account changed. Stop and reopen your assigned search.');
      await options.store.put({ eventId: crypto.randomUUID(), ownerId: options.ownerId, sessionId: options.sessionId,
        capturedAt: new Date(position.timestamp).toISOString(), latitude: position.coords.latitude,
        longitude: position.coords.longitude, accuracyMetres: position.coords.accuracy, source });
      await report('Location saved on this device.');
      void flush();
    },
    flush,
    dispose() { disposed = true; controller.abort(); },
  };
}

export function indexedMovementStore(): MovementStore {
  let database: Promise<IDBDatabase> | undefined;
  function open() {
    return database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('survey-guru-movement', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('points', { keyPath: 'eventId' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close older Survey Guru tabs to enable device storage.'));
    });
  }
  async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('points', mode);
      const request = action(tx.objectStore('points'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Device storage failed.'));
    });
  }
  return {
    async put(point) { await run('readwrite', s => s.put(point)); },
    async remove(id) { await run('readwrite', s => s.delete(id)); },
    async list(ownerId, sessionId) {
      const points = await run<QueuedMovement[]>('readonly', s => s.getAll());
      return points.filter(p => p.ownerId === ownerId && p.sessionId === sessionId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.eventId.localeCompare(b.eventId));
    },
  };
}
