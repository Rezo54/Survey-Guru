import type { StoreCaptureStatus, StoreDataRights } from './store-capture.js';

export type StreetCoverageFilter = 'WALKED' | 'NOT_WALKED' | 'UNRESOLVED';

export type StoreExploreQuery = Readonly<{
  workspaceId: string;
  authorisedProjectIds: readonly string[];
  projectIds?: readonly string[];
  teamMemberIds?: readonly string[];
  coverage?: readonly StreetCoverageFilter[];
  text?: string;
  storeNames?: readonly string[];
  brands?: readonly string[];
  productCategories?: readonly string[];
  minimumMonthlyVolume?: number;
  maximumMonthlyVolume?: number;
  minimumPrice?: number;
  maximumPrice?: number;
  statuses?: readonly StoreCaptureStatus[];
  dataRights?: readonly StoreDataRights[];
  pageSize?: number;
  cursor?: string;
}>;

export type NormalisedStoreExploreQuery = Readonly<{
  workspaceId: string;
  projectIds: readonly string[];
  teamMemberIds: readonly string[];
  coverage: readonly StreetCoverageFilter[];
  text?: string;
  storeNames: readonly string[];
  brands: readonly string[];
  productCategories: readonly string[];
  minimumMonthlyVolume?: number;
  maximumMonthlyVolume?: number;
  minimumPrice?: number;
  maximumPrice?: number;
  statuses: readonly StoreCaptureStatus[];
  dataRights: readonly StoreDataRights[];
  pageSize: number;
  cursor?: string;
}>;

function uniqueNonEmpty(values: readonly string[] | undefined): readonly string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
}

function finiteNonNegative(value: number | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite non-negative number.`);
  return value;
}

export function normaliseStoreExploreQuery(query: StoreExploreQuery): NormalisedStoreExploreQuery {
  if (!query.workspaceId.trim()) throw new Error('An authorised workspace is required.');
  const authorisedProjects = new Set(uniqueNonEmpty(query.authorisedProjectIds));
  if (authorisedProjects.size === 0) throw new Error('At least one authorised project is required.');
  const requestedProjects = uniqueNonEmpty(query.projectIds);
  const projectIds = requestedProjects.length === 0 ? [...authorisedProjects].sort() : requestedProjects;
  const unauthorised = projectIds.filter((projectId) => !authorisedProjects.has(projectId));
  if (unauthorised.length > 0) throw new Error(`Project access denied: ${unauthorised.join(', ')}.`);

  const minimumMonthlyVolume = finiteNonNegative(query.minimumMonthlyVolume, 'Minimum monthly volume');
  const maximumMonthlyVolume = finiteNonNegative(query.maximumMonthlyVolume, 'Maximum monthly volume');
  const minimumPrice = finiteNonNegative(query.minimumPrice, 'Minimum price');
  const maximumPrice = finiteNonNegative(query.maximumPrice, 'Maximum price');
  if (minimumMonthlyVolume !== undefined && maximumMonthlyVolume !== undefined && minimumMonthlyVolume > maximumMonthlyVolume) throw new Error('Minimum monthly volume cannot exceed maximum monthly volume.');
  if (minimumPrice !== undefined && maximumPrice !== undefined && minimumPrice > maximumPrice) throw new Error('Minimum price cannot exceed maximum price.');
  const pageSize = query.pageSize ?? 100;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error('Page size must be between 1 and 500.');

  return {
    workspaceId: query.workspaceId.trim(),
    projectIds,
    teamMemberIds: uniqueNonEmpty(query.teamMemberIds),
    coverage: [...new Set(query.coverage ?? [])].sort(),
    ...(query.text?.trim() ? { text: query.text.trim() } : {}),
    storeNames: uniqueNonEmpty(query.storeNames),
    brands: uniqueNonEmpty(query.brands),
    productCategories: uniqueNonEmpty(query.productCategories),
    ...(minimumMonthlyVolume === undefined ? {} : { minimumMonthlyVolume }),
    ...(maximumMonthlyVolume === undefined ? {} : { maximumMonthlyVolume }),
    ...(minimumPrice === undefined ? {} : { minimumPrice }),
    ...(maximumPrice === undefined ? {} : { maximumPrice }),
    statuses: [...new Set(query.statuses ?? [])].sort(),
    dataRights: [...new Set(query.dataRights ?? [])].sort(),
    pageSize,
    ...(query.cursor?.trim() ? { cursor: query.cursor.trim() } : {}),
  };
}

