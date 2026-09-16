import { getFirebaseAdminServices } from './firebase-admin.js';
import { buildOverpassRoadQuery, projectStreetSegmentsFromOverpass, type OverpassResponse } from './osm-street-geometry.js';
import { parseOptionalBoundary } from './street-coverage-data.js';

const projectId = process.env.SURVEY_GURU_GEOMETRY_PROJECT_ID;
const confirmed = process.env.SURVEY_GURU_DEV_OSM_IMPORT_CONFIRMED === 'IMPORT_DEV_ROADS';
const disableCoarseFixtures = process.env.SURVEY_GURU_DISABLE_COARSE_FIXTURES === 'true';
const endpoint = process.env.OVERPASS_API_URL ?? 'https://overpass-api.de/api/interpreter';
const maximumSegments = Number(process.env.SURVEY_GURU_MAX_DEV_STREET_SEGMENTS ?? 3000);

if (process.env.NODE_ENV === 'production') throw new Error('The development road importer cannot run in production.');
if (!confirmed) throw new Error('Set SURVEY_GURU_DEV_OSM_IMPORT_CONFIRMED=IMPORT_DEV_ROADS to acknowledge the development GIS import.');
if (!projectId) throw new Error('Set SURVEY_GURU_GEOMETRY_PROJECT_ID to the development project to import.');
if (!endpoint.startsWith('https://')) throw new Error('OVERPASS_API_URL must use HTTPS.');
if (!Number.isInteger(maximumSegments) || maximumSegments < 1 || maximumSegments > 10_000) throw new Error('SURVEY_GURU_MAX_DEV_STREET_SEGMENTS must be between 1 and 10,000.');

const { firestore } = getFirebaseAdminServices();
const project = await firestore.collection('projects').doc(projectId).get();
if (!project.exists || project.get('environment') !== 'dev') throw new Error('Road imports are restricted to an existing development project.');
const workspaceId = project.get('workspaceId');
if (typeof workspaceId !== 'string') throw new Error('The development project has no valid workspace.');
const boundary = parseOptionalBoundary(project.get('boundary'));
if (boundary.length < 3) throw new Error('The development project must have a server-owned polygon boundary.');

const query = buildOverpassRoadQuery(boundary);
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'user-agent': 'Survey-Guru-development-road-import/1.0',
  },
  body: new URLSearchParams({ data: query }),
  signal: AbortSignal.timeout(120_000),
});
if (!response.ok) throw new Error(`Road provider returned HTTP ${response.status}.`);
const contentLength = Number(response.headers.get('content-length') ?? 0);
if (contentLength > 25_000_000) throw new Error('Road provider response exceeded the development import limit.');
const payload = await response.json() as OverpassResponse;
const segments = projectStreetSegmentsFromOverpass({ response: payload, workspaceId, projectId, boundary });
if (segments.length === 0) throw new Error('The provider returned no eligible project street geometry.');
if (segments.length > maximumSegments) throw new Error(`The development import returned ${segments.length} segments, above the configured limit of ${maximumSegments}. Reduce the project polygon or raise the explicit development limit.`);

const importedAt = new Date().toISOString();
for (let start = 0; start < segments.length; start += 350) {
  const batch = firestore.batch();
  for (const segment of segments.slice(start, start + 350)) {
    const { id, ...data } = segment;
    batch.set(firestore.collection('projectStreetSegments').doc(id), {
      ...data,
      geometryQuality: 'AUTHORITATIVE_EXTERNAL',
      attribution: '© OpenStreetMap contributors',
      licence: 'ODbL-1.0',
      importBatchId: `osm_${projectId}_${importedAt}`,
      importedAt,
      environment: 'dev',
      verificationStatus: 'UNVERIFIED',
    }, { merge: true });
  }
  await batch.commit();
}

if (disableCoarseFixtures) {
  const coarse = await firestore.collection('projectStreetSegments').where('projectId', '==', projectId).where('source.provider', '==', 'dev-fixture').get();
  for (let start = 0; start < coarse.docs.length; start += 350) {
    const batch = firestore.batch();
    for (const document of coarse.docs.slice(start, start + 350)) batch.update(document.ref, { eligible: false, supersededAt: importedAt });
    await batch.commit();
  }
}

await firestore.collection('streetGeometryImports').add({
  workspaceId,
  projectId,
  provider: 'openstreetmap',
  segmentCount: segments.length,
  importedAt,
  boundaryVersion: project.get('boundaryVersion') ?? null,
  coarseFixturesDisabled: disableCoarseFixtures,
  environment: 'dev',
});

console.log(`Imported ${segments.length} polygon-scoped development street segments for ${projectId}.`);
