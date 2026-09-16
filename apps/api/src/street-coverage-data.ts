import type { Coordinate, CoverageContribution, ProjectStreetSegment } from './map-matching.js';

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function coordinates(value: unknown): readonly Coordinate[] {
  if (!Array.isArray(value)) throw new Error('Project street geometry is invalid.');
  const result = value.map((point) => {
    if (!point || typeof point !== 'object') throw new Error('Project street geometry is invalid.');
    const latitude = Reflect.get(point, 'latitude');
    const longitude = Reflect.get(point, 'longitude');
    if (!finite(latitude) || !finite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error('Project street geometry is invalid.');
    return { latitude, longitude };
  });
  if (result.length < 2) throw new Error('Project street geometry requires at least two coordinates.');
  return result;
}

export function parseOptionalBoundary(value: unknown): readonly Coordinate[] {
  if (value === undefined || value === null) return [];
  const boundary = coordinates(value);
  if (boundary.length < 3) throw new Error('Project boundary requires at least three coordinates.');
  return boundary;
}

export function parseProjectStreetSegment(id: string, data: Record<string, unknown>): ProjectStreetSegment {
  const { workspaceId, projectId, streetSegmentId, lengthMetres, geometry, source } = data;
  if (typeof workspaceId !== 'string' || typeof projectId !== 'string' || typeof streetSegmentId !== 'string' || !finite(lengthMetres) || lengthMetres <= 0 || !source || typeof source !== 'object') throw new Error('Project street segment is invalid.');
  const provider = Reflect.get(source, 'provider');
  const sourceId = Reflect.get(source, 'sourceId');
  const sourceVersion = Reflect.get(source, 'sourceVersion');
  if (typeof provider !== 'string' || typeof sourceId !== 'string' || typeof sourceVersion !== 'string') throw new Error('Project street source provenance is invalid.');
  const connected = data.connectedProjectStreetSegmentIds;
  const connectedProjectStreetSegmentIds = Array.isArray(connected) ? connected.filter((value): value is string => typeof value === 'string') : undefined;
  const base = { id, workspaceId, projectId, streetSegmentId, lengthMetres, geometry: coordinates(geometry), eligible: data.eligible === true, source: { provider, sourceId, sourceVersion } };
  return connectedProjectStreetSegmentIds ? { ...base, connectedProjectStreetSegmentIds } : base;
}

export function parseCoverageContribution(id: string, data: Record<string, unknown>): CoverageContribution {
  const requiredStrings = ['projectId', 'projectStreetSegmentId', 'searchSessionId', 'userId', 'algorithmVersion'] as const;
  for (const field of requiredStrings) if (typeof data[field] !== 'string') throw new Error(`Street coverage contribution ${id} is invalid.`);
  if (!finite(data.startOffsetMetres) || !finite(data.endOffsetMetres) || !finite(data.coveragePolicyVersion)) throw new Error(`Street coverage contribution ${id} is invalid.`);
  return {
    projectId: data.projectId as string,
    projectStreetSegmentId: data.projectStreetSegmentId as string,
    searchSessionId: data.searchSessionId as string,
    userId: data.userId as string,
    evidenceId: typeof data.evidenceId === 'string' ? data.evidenceId : id,
    startOffsetMetres: data.startOffsetMetres,
    endOffsetMetres: data.endOffsetMetres,
    algorithmVersion: data.algorithmVersion as string,
    coveragePolicyVersion: data.coveragePolicyVersion,
    ...(typeof data.geometryVersion === 'string' ? { geometryVersion: data.geometryVersion } : {}),
  };
}
