export type SurveyGuruRuntime = 'pwa' | 'android';

export interface RuntimeCapabilities {
  runtime: SurveyGuruRuntime;
  camera: boolean;
  offlineStore: boolean;
  backgroundLocation: boolean;
  durableBackgroundSync: boolean;
}

export function detectRuntimeCapabilities(runtime: SurveyGuruRuntime): RuntimeCapabilities {
  if (runtime === 'android') {
    return {
      runtime,
      camera: true,
      offlineStore: true,
      backgroundLocation: true,
      durableBackgroundSync: true
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
