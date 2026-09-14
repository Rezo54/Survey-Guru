export type SurveyGuruRuntime = 'pwa' | 'android';

export interface RuntimeCapabilities {
  runtime: SurveyGuruRuntime;
  camera: boolean;
  offlineStore: boolean;
  backgroundLocation: boolean;
  durableBackgroundSync: boolean;
}

/**
 * Report only capabilities that are implemented and evidenced in the current
 * checkpoint. Packaging the PWA with Capacitor does not by itself prove native
 * background location or durable background sync.
 */
export function detectRuntimeCapabilities(runtime: SurveyGuruRuntime): RuntimeCapabilities {
  if (runtime === 'android') {
    return {
      runtime,
      camera: true,
      offlineStore: true,
      backgroundLocation: false,
      durableBackgroundSync: false
    };
  }

  return {
    runtime,
    camera: true,
    offlineStore: true,
    backgroundLocation: false,
    durableBackgroundSync: false
  };
}

export function requiresAndroidForCoverage(capabilities: RuntimeCapabilities): boolean {
  return !capabilities.backgroundLocation || !capabilities.durableBackgroundSync;
}
