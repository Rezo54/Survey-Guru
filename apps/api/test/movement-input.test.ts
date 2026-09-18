import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMovement, movementKey, movementFingerprint, validateMovement, type Point } from '../src/movement-input.js';
const now = Date.parse('2026-09-18T10:00:00Z');
const input = { eventId:'11111111-1111-4111-8111-111111111111', capturedAt:'2026-09-18T09:59:50Z', latitude:-26.2, longitude:28.04, accuracyMetres:5, source:'pwa_foreground' as const };
test('offline points preserve capture time for seven days, reject expired and future fixes', () => {
  assert.equal(parseMovement({...input,capturedAt:new Date(now-6*86400000).toISOString()},now).source,'pwa_foreground');
  assert.throws(()=>parseMovement({...input,capturedAt:new Date(now-8*86400000).toISOString()},now));
  assert.throws(()=>parseMovement({...input,capturedAt:new Date(now+61000).toISOString()},now));
  assert.throws(()=>parseMovement({...input,latitude:NaN},now));
  assert.throws(()=>parseMovement({...input,eventId:'../bad'},now));
});
test('retry identity is account and session scoped; altered payload has a different fingerprint', () => {
  const point=parseMovement(input,now);
  assert.equal(movementKey('u','s',point.eventId),movementKey('u','s',point.eventId));
  assert.notEqual(movementKey('other','s',point.eventId),movementKey('u','s',point.eventId));
  assert.notEqual(movementKey('u','other',point.eventId),movementKey('u','s',point.eventId));
  assert.notEqual(movementFingerprint(point),movementFingerprint({...point,latitude:-26.3}));
});
test('uncertain, out-of-order and impossible movement cannot advance the accepted sequence', () => {
  const point=parseMovement(input,now); const previous:Point={...point,id:'p',validationStatus:'ACCEPTED'};
  assert.equal(validateMovement({...point,accuracyMetres:101},previous).status,'REJECTED_ACCURACY');
  assert.equal(validateMovement(point,previous).status,'REJECTED_SEQUENCE');
  assert.equal(validateMovement({...point,capturedAt:'2026-09-18T09:59:59Z'},previous).status,'REJECTED_DUPLICATE');
  assert.equal(validateMovement({...point,capturedAt:'2026-09-18T09:59:59Z',latitude:0},previous).status,'REJECTED_SPEED');
  assert.equal(validateMovement({...point,capturedAt:'2026-09-18T09:59:59Z',latitude:-26.2002},previous).status,'ACCEPTED');
});
