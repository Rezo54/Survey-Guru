import { createHash } from 'node:crypto';

export type MovementInput = { eventId: string; capturedAt: string; latitude: number; longitude: number; accuracyMetres: number; source: 'pwa_foreground' | 'native_background' };
export function parseMovement(input: unknown, now = Date.now()): MovementInput {
  const b = input as Partial<MovementInput> | null;
  if (!b || typeof b.eventId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(b.eventId)) throw new Error('A stable movement event ID is required.');
  if (typeof b.latitude !== 'number' || !Number.isFinite(b.latitude) || Math.abs(b.latitude) > 90 || typeof b.longitude !== 'number' || !Number.isFinite(b.longitude) || Math.abs(b.longitude) > 180) throw new Error('Movement coordinates are invalid.');
  if (typeof b.accuracyMetres !== 'number' || !Number.isFinite(b.accuracyMetres) || b.accuracyMetres < 0 || b.accuracyMetres > 500) throw new Error('Movement accuracy is invalid.');
  if (typeof b.capturedAt !== 'string' || !Number.isFinite(Date.parse(b.capturedAt)) || Date.parse(b.capturedAt) > now + 60_000 || Date.parse(b.capturedAt) < now - 7 * 86400_000) throw new Error('Movement must be synchronised within seven days of capture.');
  if (b.source !== 'pwa_foreground' && b.source !== 'native_background') throw new Error('Movement source is invalid.');
  return { eventId: b.eventId, capturedAt: new Date(b.capturedAt).toISOString(), latitude: b.latitude, longitude: b.longitude, accuracyMetres: b.accuracyMetres, source: b.source };
}
export function movementKey(uid: string, sessionId: string, eventId: string) {
  return createHash('sha256').update(JSON.stringify([uid, sessionId, eventId])).digest('hex');
}
export function movementFingerprint(input: MovementInput) { return createHash('sha256').update(JSON.stringify(input)).digest('hex'); }
export type Point = { id: string; capturedAt: string; latitude: number; longitude: number; accuracyMetres: number; validationStatus: 'ACCEPTED' };
export function validateMovement(point: MovementInput, previous?: Point | null) {
  if (point.accuracyMetres > 100) return { status: 'REJECTED_ACCURACY', reason: 'GPS uncertainty exceeds 100 metres.' };
  if (previous) {
    const seconds = (Date.parse(point.capturedAt) - Date.parse(previous.capturedAt)) / 1000;
    if (seconds <= 0) return { status: 'REJECTED_SEQUENCE', reason: 'This point is older than the last accepted location.' };
    const rad = Math.PI / 180;
    const h = Math.sin((point.latitude - previous.latitude) * rad / 2) ** 2 + Math.cos(previous.latitude * rad) * Math.cos(point.latitude * rad) * Math.sin((point.longitude - previous.longitude) * rad / 2) ** 2;
    const metres = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    if (metres <= Math.max(10, point.accuracyMetres)) return { status: 'REJECTED_DUPLICATE', reason: 'No movement beyond GPS uncertainty.' };
    if (metres / seconds > 55.56) return { status: 'REJECTED_SPEED', reason: 'Movement above 200 km/h cannot support coverage.' };
  }
  return { status: 'ACCEPTED', reason: 'Location saved; street matching determines coverage.' };
}
