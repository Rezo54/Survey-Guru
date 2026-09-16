import type { Coordinate, ProjectStreetSegment } from './map-matching.js';

type OverpassWay = Readonly<{
  type: 'way';
  id: number;
  version?: number;
  timestamp?: string;
  tags?: Readonly<Record<string, string>>;
  geometry?: ReadonlyArray<Readonly<{ lat: number; lon: number }>>;
}>;

export type OverpassResponse = Readonly<{ elements?: readonly unknown[] }>;

const eligibleHighways = new Set([
  'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service',
]);

function finiteCoordinate(point: Coordinate): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}

function pointInPolygon(point: Coordinate, polygon: readonly Coordinate[]): boolean {
  let inside = false;
  for (let left = 0, right = polygon.length - 1; left < polygon.length; right = left, left += 1) {
    const a = polygon[left];
    const b = polygon[right];
    if (!a || !b) continue;
    const crosses = (a.latitude > point.latitude) !== (b.latitude > point.latitude)
      && point.longitude < (b.longitude - a.longitude) * (point.latitude - a.latitude) / (b.latitude - a.latitude) + a.longitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

function splitInsideRuns(geometry: readonly Coordinate[], boundary: readonly Coordinate[]): readonly Coordinate[][] {
  const runs: Coordinate[][] = [];
  let current: Coordinate[] = [];
  for (const point of geometry) {
    if (pointInPolygon(point, boundary)) {
      current.push(point);
    } else if (current.length > 0) {
      if (current.length >= 2) runs.push(current);
      current = [];
    }
  }
  if (current.length >= 2) runs.push(current);
  return runs;
}

function distanceMetres(left: Coordinate, right: Coordinate): number {
  const earth = 6_371_000;
  const latitudeRadians = left.latitude * Math.PI / 180;
  const x = (right.longitude - left.longitude) * Math.PI / 180 * earth * Math.cos(latitudeRadians);
  const y = (right.latitude - left.latitude) * Math.PI / 180 * earth;
  return Math.hypot(x, y);
}

function polylineLengthMetres(geometry: readonly Coordinate[]): number {
  let total = 0;
  for (let index = 1; index < geometry.length; index += 1) {
    const from = geometry[index - 1];
    const to = geometry[index];
    if (from && to) total += distanceMetres(from, to);
  }
  return Number(total.toFixed(3));
}

export function buildOverpassRoadQuery(boundary: readonly Coordinate[]): string {
  if (boundary.length < 3 || boundary.some((point) => !finiteCoordinate(point))) throw new Error('A valid project boundary is required for a road import.');
  const polygon = boundary.map((point) => `${point.latitude} ${point.longitude}`).join(' ');
  return `[out:json][timeout:90];way["highway"](poly:"${polygon}");out geom meta;`;
}

export function projectStreetSegmentsFromOverpass(input: Readonly<{
  response: OverpassResponse;
  workspaceId: string;
  projectId: string;
  boundary: readonly Coordinate[];
}>): readonly ProjectStreetSegment[] {
  if (input.boundary.length < 3) throw new Error('A project boundary is required.');
  const result: ProjectStreetSegment[] = [];
  for (const element of input.response.elements ?? []) {
    if (!element || typeof element !== 'object' || Reflect.get(element, 'type') !== 'way') continue;
    const way = element as OverpassWay;
    const highway = way.tags?.highway;
    if (!Number.isInteger(way.id) || !highway || !eligibleHighways.has(highway) || !Array.isArray(way.geometry)) continue;
    const geometry = way.geometry.map((point) => ({ latitude: point.lat, longitude: point.lon })).filter(finiteCoordinate);
    const runs = splitInsideRuns(geometry, input.boundary);
    runs.forEach((run, runIndex) => {
      const lengthMetres = polylineLengthMetres(run);
      if (lengthMetres < 5) return;
      const sourceVersion = `${way.version ?? 'unknown'}@${way.timestamp ?? 'unknown'}`;
      result.push({
        id: `pss_osm_${way.id}_${runIndex}`,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        streetSegmentId: `osm_way_${way.id}_${runIndex}`,
        eligible: true,
        lengthMetres,
        geometry: run,
        source: { provider: 'openstreetmap', sourceId: `way/${way.id}`, sourceVersion },
      });
    });
  }
  return result;
}
