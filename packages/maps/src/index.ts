export type CoverageState = 'UNVISITED' | 'IN_PROGRESS' | 'SEARCHED' | 'VERIFIED';

export interface GeographicEvidenceRef {
  id: string;
  coverageState: CoverageState;
  confidence?: number;
}

export const geographicTruthRules = {
  outletPresenceDoesNotProveCoverage: true,
  gpsDoesNotEqualCoverage: true,
  searchedZeroFoundIsDurableEvidence: true
} as const;
