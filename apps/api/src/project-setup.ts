export type BoundaryPoint = Readonly<{ latitude: number; longitude: number }>;

export class ProjectSetupValidationError extends Error {}

const EARTH_RADIUS_METRES = 6_371_000;

function finiteCoordinate(point: BoundaryPoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && point.latitude >= -90 && point.latitude <= 90
    && point.longitude >= -180 && point.longitude <= 180;
}

export function polygonAreaSquareKm(boundary: readonly BoundaryPoint[]): number {
  if (boundary.length < 3) return 0;
  const meanLatitude = boundary.reduce((total, point) => total + point.latitude, 0) / boundary.length;
  const longitudeScale = Math.cos(meanLatitude * Math.PI / 180);
  const projected = boundary.map((point) => ({
    x: EARTH_RADIUS_METRES * point.longitude * Math.PI / 180 * longitudeScale,
    y: EARTH_RADIUS_METRES * point.latitude * Math.PI / 180,
  }));
  let twiceArea = 0;
  for (let index = 0; index < projected.length; index += 1) {
    const current = projected[index]!;
    const next = projected[(index + 1) % projected.length]!;
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) / 2 / 1_000_000;
}

export function validateProjectSetup(input: {
  name?: unknown;
  areaName?: unknown;
  boundary?: unknown;
}): { name: string; areaName: string; boundary: BoundaryPoint[]; areaSquareKm: number } {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const areaName = typeof input.areaName === 'string' ? input.areaName.trim() : '';
  if (name.length < 3 || name.length > 100) throw new ProjectSetupValidationError('Project name must contain 3 to 100 characters.');
  if (areaName.length < 2 || areaName.length > 100) throw new ProjectSetupValidationError('Capture area name must contain 2 to 100 characters.');
  if (!Array.isArray(input.boundary) || input.boundary.length < 3 || input.boundary.length > 100) throw new ProjectSetupValidationError('Draw a project boundary with 3 to 100 points.');

  const boundary = input.boundary.map((value) => {
    if (!value || typeof value !== 'object') throw new ProjectSetupValidationError('Project boundary coordinates are invalid.');
    const point = value as { latitude?: unknown; longitude?: unknown };
    const coordinate = { latitude: point.latitude, longitude: point.longitude } as BoundaryPoint;
    if (!finiteCoordinate(coordinate)) throw new ProjectSetupValidationError('Project boundary coordinates are invalid.');
    return coordinate;
  });
  const areaSquareKm = polygonAreaSquareKm(boundary);
  if (areaSquareKm < 0.002) throw new ProjectSetupValidationError('The project boundary is too small to form a useful capture area.');
  if (areaSquareKm > 100) throw new ProjectSetupValidationError('The development project boundary may not exceed 100 km². Draw a smaller test area.');
  return { name, areaName, boundary, areaSquareKm };
}
