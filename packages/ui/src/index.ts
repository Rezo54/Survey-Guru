export type SurfaceDensity = 'compact' | 'comfortable';

export interface GeographicStatusTone {
  label: string;
  state: 'covered' | 'partial' | 'outstanding' | 'opportunity';
}

export const surveyGuruUiFoundation = {
  hierarchy: ['map', 'geographic-status', 'exceptions-actions', 'supporting-detail'] as const,
  fieldNavigation: ['today', 'assignments', 'map', 'sync'] as const
};
