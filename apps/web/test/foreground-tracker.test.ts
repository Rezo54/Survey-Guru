import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createForegroundTracker } from '../src/app/field/map/foreground-tracker.js';

function setup() {
  let success: PositionCallback = () => {};
  let failure: PositionErrorCallback = () => {};
  let now = 100_000;
  let available = true;
  let watches = 0;
  let cleared = 0;
  let uploads = 0;
  let signal: AbortSignal | undefined;
  let finish: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const states: string[] = [];
  const tracker = createForegroundTracker({
    geolocation: {
      watchPosition(ok, error) { success = ok; failure = error!; watches++; return 0; },
      clearWatch(id) { assert.equal(id, 0); cleared++; },
    },
    isAvailable: () => available,
    now: () => now,
    onState: (state) => states.push(state),
    submit: (_, abortSignal) => { uploads++; signal = abortSignal; return new Promise<void>((resolve, fail) => { finish = resolve; reject = fail; }); },
  });
  return {
    tracker, states,
    emit: (timestamp = now) => success({ timestamp, coords: { latitude: 1, longitude: 2, accuracy: 5 } } as GeolocationPosition),
    fail: () => failure({ code: 1 } as GeolocationPositionError),
    advance: () => { now += 10_000; },
    unavailable: () => { available = false; },
    finish: async () => { finish(); await new Promise(setImmediate); },
    reject: async () => { reject(new Error('Upload failed')); await new Promise(setImmediate); },
    counts: () => ({ watches, cleared, uploads }),
    aborted: () => signal?.aborted,
  };
}

test('explicit start, single watcher, serialized and spaced uploads', async () => {
  const f = setup();
  assert.equal(f.counts().watches, 0);
  f.tracker.start(); f.tracker.start(); f.emit(); f.advance(); f.emit();
  assert.deepEqual(f.counts(), { watches: 1, cleared: 0, uploads: 1 });
  await f.finish(); f.emit(); await f.finish(); f.emit();
  assert.equal(f.counts().uploads, 2);
  f.tracker.stop();
});

test('stop aborts upload and ignores callbacks already queued by the browser', async () => {
  const f = setup(); f.tracker.start(); f.emit(); f.tracker.stop(); f.advance(); f.emit();
  assert.equal(f.aborted(), true);
  assert.equal(f.counts().uploads, 1);
  f.tracker.start(); assert.equal(f.counts().watches, 1);
  await f.finish(); f.tracker.start(); assert.equal(f.counts().watches, 2);
  f.tracker.stop();
});

test('hidden or offline collection stops; starting unavailable creates no watcher', () => {
  const f = setup(); f.tracker.start(); f.unavailable(); f.emit();
  assert.equal(f.counts().cleared, 1); assert.equal(f.counts().uploads, 0);
  f.tracker.start(); assert.equal(f.counts().watches, 1);
});

test('permission denial clears watcher and requires explicit restart', () => {
  const f = setup(); f.tracker.start(); f.fail(); f.emit();
  assert.equal(f.states.at(-1), 'error'); assert.equal(f.counts().uploads, 0);
  assert.equal(f.counts().cleared, 1);
});

test('stale fixes are skipped and failed uploads stop without retry', async () => {
  const f = setup(); f.tracker.start(); f.emit(0); assert.equal(f.counts().uploads, 0);
  f.emit(); await f.reject(); f.advance(); f.emit();
  assert.equal(f.counts().uploads, 1); assert.equal(f.states.at(-1), 'error');
});
