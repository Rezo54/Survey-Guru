export type TrackingState = 'idle' | 'tracking' | 'stopped' | 'error';

/** Foreground, online-only collection. Never retries an ambiguously acknowledged POST. */
export function createForegroundTracker(options: {
  geolocation: Pick<Geolocation, 'watchPosition' | 'clearWatch'>;
  isAvailable: () => boolean;
  submit: (position: GeolocationPosition, signal: AbortSignal) => Promise<void>;
  onState: (state: TrackingState, message: string) => void;
  now?: () => number;
}) {
  let watch: number | undefined;
  let generation = 0;
  let running = false;
  let pending = false;
  let lastSubmitted = -Infinity;
  let request: AbortController | undefined;
  const now = options.now ?? Date.now;

  function stop(message = 'Tracking stopped.', state: TrackingState = 'stopped') {
    running = false;
    generation += 1;
    if (watch !== undefined) options.geolocation.clearWatch(watch);
    watch = undefined;
    request?.abort();
    options.onState(state, message);
  }

  function start() {
    if (running || pending) return;
    if (!options.isAvailable()) {
      options.onState('error', 'Keep this page visible and connect to the internet before starting tracking.');
      return;
    }
    running = true;
    lastSubmitted = -Infinity;
    const current = ++generation;
    options.onState('tracking', 'Tracking while this page is visible. Keep the screen unlocked.');
    try {
      watch = options.geolocation.watchPosition((position) => {
        if (!running || generation !== current) return;
        if (!options.isAvailable()) { stop('Tracking stopped. Return online with this page visible, then start again.'); return; }
        const timestamp = now();
        if (pending || timestamp - lastSubmitted < 10_000) return;
        if (!Number.isFinite(position.timestamp) || timestamp - position.timestamp > 30_000 || position.timestamp > timestamp + 1_000) return;
        pending = true;
        lastSubmitted = timestamp;
        const controller = new AbortController();
        request = controller;
        void options.submit(position, controller.signal).catch((error: unknown) => {
          if (generation === current) stop(error instanceof Error ? error.message : 'Location could not be saved. Check recent progress before restarting.', 'error');
        }).finally(() => { pending = false; if (request === controller) request = undefined; });
      }, (error) => {
        if (generation !== current) return;
        stop(error.code === 1 ? 'Location permission denied. Allow location access, then start tracking again.' : 'GPS unavailable. Move to a clearer area, then start tracking again.', 'error');
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
    } catch {
      stop('Location tracking could not start in this browser.', 'error');
    }
  }

  return { start, stop };
}
