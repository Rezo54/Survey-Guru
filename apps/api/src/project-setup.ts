export type BoundaryPoint = Readonly<{ latitude: number; longitude: number }>;
export type ProjectQuestion = Readonly<{ id: string; label: string; type: 'text' | 'number' | 'select'; required: boolean; options: readonly string[] }>;
export type ProjectProduct = Readonly<{ brand: string; product: string; active: boolean; displayOrder: number }>;

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
  timeZone?: unknown;
  formTemplateId?: unknown;
  questions?: unknown;
  productCatalogue?: unknown;
}): { name: string; areaName: string; boundary: BoundaryPoint[]; areaSquareKm: number; timeZone: string; formTemplateId: 'STANDARD_FMCG' | 'CUSTOM'; questions: ProjectQuestion[]; productCatalogue: ProjectProduct[] } {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const areaName = typeof input.areaName === 'string' ? input.areaName.trim() : '';
  if (name.length < 3 || name.length > 100) throw new ProjectSetupValidationError('Project name must contain 3 to 100 characters.');
  if (areaName.length < 2 || areaName.length > 100) throw new ProjectSetupValidationError('Capture area name must contain 2 to 100 characters.');
  const timeZone = typeof input.timeZone === 'string' ? input.timeZone.trim() : '';
  try { if (!timeZone || new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone !== timeZone) throw new Error(); }
  catch { throw new ProjectSetupValidationError('Select a valid project-area timezone.'); }
  const formTemplateId = input.formTemplateId === 'CUSTOM' ? 'CUSTOM' : 'STANDARD_FMCG';
  if (!Array.isArray(input.questions) || input.questions.length > 30) throw new ProjectSetupValidationError('The questionnaire may contain up to 30 custom questions.');
  const questions = input.questions.map((value, index) => {
    if (!value || typeof value !== 'object') throw new ProjectSetupValidationError(`Question ${index + 1} is invalid.`);
    const item = value as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const type = item.type === 'number' || item.type === 'select' ? item.type : 'text';
    const options = Array.isArray(item.options) ? item.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 30) : [];
    if (!/^[A-Za-z][A-Za-z0-9_]{1,49}$/.test(id) || label.length < 2 || label.length > 100) throw new ProjectSetupValidationError(`Question ${index + 1} needs a valid field name and label.`);
    if (type === 'select' && options.length < 2) throw new ProjectSetupValidationError(`Question ${label} needs at least two selectable options.`);
    return { id, label, type, required: item.required !== false, options } as ProjectQuestion;
  });
  if (new Set(questions.map((question) => question.id)).size !== questions.length) throw new ProjectSetupValidationError('Question field names must be unique.');
  const rawProductCatalogue = input.productCatalogue === undefined ? [] : input.productCatalogue;
  if (!Array.isArray(rawProductCatalogue) || rawProductCatalogue.length > 2000) throw new ProjectSetupValidationError('The product catalogue may contain up to 2,000 products.');
  const productCatalogue = rawProductCatalogue.map((value, index) => {
    if (!value || typeof value !== 'object') throw new ProjectSetupValidationError(`Product ${index + 1} is invalid.`);
    const item = value as Record<string, unknown>; const brand = String(item.brand ?? '').trim(); const product = String(item.product ?? '').trim();
    if (brand.length < 2 || brand.length > 80 || product.length < 2 || product.length > 120) throw new ProjectSetupValidationError(`Product ${index + 1} needs a valid brand and product name.`);
    return { brand, product, active: item.active !== false, displayOrder: Number.isFinite(Number(item.displayOrder)) ? Number(item.displayOrder) : index + 1 } as ProjectProduct;
  });
  const productKeys = productCatalogue.map((item) => `${item.brand.toLocaleLowerCase()}\u0000${item.product.toLocaleLowerCase()}`);
  if (new Set(productKeys).size !== productKeys.length) throw new ProjectSetupValidationError('The product catalogue contains duplicate brand and product combinations.');
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
  return { name, areaName, boundary, areaSquareKm, timeZone, formTemplateId, questions, productCatalogue };
}

export function validateProjectAssignment(input: { userId?: unknown; areaName?: unknown }): { userId: string; areaName: string } {
  const userId = typeof input.userId === 'string' ? input.userId.trim() : '';
  const areaName = typeof input.areaName === 'string' ? input.areaName.trim() : '';
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(userId)) throw new ProjectSetupValidationError('Select a valid active capturer.');
  if (areaName.length < 2 || areaName.length > 100) throw new ProjectSetupValidationError('Capture area name must contain 2 to 100 characters.');
  return { userId, areaName };
}
