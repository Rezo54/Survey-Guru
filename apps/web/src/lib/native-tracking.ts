'use client';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import { createMovementQueue, SyncError, type QueuedMovement } from '../app/field/map/movement-queue';
import { fieldApiOrigin, getFieldToken, getFieldUserId } from '../app/field/map/field-api';

type NativeState = { active: boolean; sessionId: string; message: string; pending: number };
const journal = BackgroundGeolocation as typeof BackgroundGeolocation & {
  configureJournal(options: { ownerId: string; sessionId: string }): Promise<void>;
  pendingJournal(options: { ownerId: string; sessionId: string }): Promise<{ points: QueuedMovement[] }>;
  acknowledgeJournal(options: { ownerId: string; sessionId: string; eventId: string }): Promise<void>;
};
let state: NativeState = { active: false, sessionId: '', message: '', pending: 0 };
const listeners = new Set<(s: NativeState) => void>();
let queue: ReturnType<typeof createMovementQueue> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
let starting = false; let generation = 0;
function update(change: Partial<NativeState>) { state = { ...state, ...change }; listeners.forEach(fn => fn(state)); }
export function nativeTrackingAvailable() { return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('BackgroundGeolocation'); }
export function subscribeNativeTracking(fn: (s: NativeState) => void) { listeners.add(fn); fn(state); return () => { listeners.delete(fn); }; }
export async function stopNativeTracking() {
  generation++; clearInterval(interval); interval = undefined;
  try { await BackgroundGeolocation.stop(); }
  catch (error) { update({ message: 'Could not confirm GPS stopped. Open phone settings to disable location access.' }); throw error; }
  queue?.dispose(); queue = undefined; starting = false;
  update({ active: false, message: 'Background GPS stopped. Pending locations remain saved on this device.' });
}
export async function startNativeTracking(sessionId: string) {
  if (starting || (state.active && state.sessionId === sessionId)) return;
  if (!nativeTrackingAvailable()) throw new Error('Open the installed Survey Guru mobile app to use background tracking.');
  if (state.active) await stopNativeTracking();
  starting = true; const run = ++generation;
  try {
    const ownerId = await getFieldUserId();
    const permissions = await BackgroundGeolocation.requestPermissions({ permissions: ['location', 'backgroundLocation', 'notification'] });
    if (permissions.location !== 'granted' || !['always', 'granted'].includes(permissions.backgroundLocation ?? '')) throw new Error('Allow precise and background location in phone settings before starting.');
    if (Capacitor.getPlatform() === 'android' && permissions.notification === 'denied') throw new Error('Allow tracking notifications in phone settings.');
    if (generation !== run) return;
    await journal.configureJournal({ ownerId, sessionId });
    const blocked = new Map<string, string>();
    queue = createMovementQueue({ store: {
      async list() { const { points } = await journal.pendingJournal({ ownerId, sessionId }); return points.sort((a,b) => a.capturedAt.localeCompare(b.capturedAt)).map(p => blocked.has(p.eventId) ? { ...p, blockedReason: blocked.get(p.eventId)! } : p); },
      async put(point) { if (point.blockedReason) blocked.set(point.eventId, point.blockedReason); },
      async remove(eventId) { await journal.acknowledgeJournal({ ownerId, sessionId, eventId }); },
    }, ownerId, sessionId, currentOwner: getFieldUserId, online: () => navigator.onLine,
      onStatus: (pending, message) => update({ pending, message }),
      send: async point => {
        const token = await getFieldToken();
        const response = await CapacitorHttp.post({ url: fieldApiOrigin() + '/api/v1/search-sessions/' + encodeURIComponent(sessionId) + '/movement-events',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, data: point, connectTimeout: 15000, readTimeout: 20000 });
        if (response.status < 200 || response.status >= 300) {
          if ([401,403].includes(response.status)) { void stopNativeTracking().catch(() => {}); }
          throw new SyncError(response.data?.message ?? 'Location sync failed.', response.status);
        }
      },
    });
    await BackgroundGeolocation.start({ backgroundTitle: 'Survey Guru field tracking', backgroundMessage: 'Recording your assigned search. Open Survey Guru to stop.', requestPermissions: false, stale: false, distanceFilter: 10, minIntervalMs: 10000 }, (location, error) => {
      if (generation !== run) return;
      if (error) { update({ message: error.message }); if (error.code === 'NOT_AUTHORIZED' || error.code === 'PERMISSION_DENIED') void stopNativeTracking().catch(() => {}); return; }
      // Native code has already committed this fix to disk before invoking JavaScript.
      if (location) void queue?.flush();
    });
    if (generation !== run) { await BackgroundGeolocation.stop(); return; }
    update({ active: true, sessionId, message: 'Background GPS is active. Use Stop tracking when your search is finished.' });
    interval = setInterval(() => { void getFieldUserId().then(id => id === ownerId ? queue?.flush() : stopNativeTracking()).catch(() => { void stopNativeTracking().catch(() => {}); }); }, 15000);
    void queue.flush();
  } catch(error) { queue?.dispose(); queue = undefined; await BackgroundGeolocation.stop().catch(() => {}); update({ active: false, message: (error as Error).message }); throw error; }
  finally { starting = false; }
}
