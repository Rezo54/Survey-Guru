import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOverpassRoadQuery, projectStreetSegmentsFromOverpass } from '../src/osm-street-geometry.js';

const boundary = [
  { latitude: -26.21, longitude: 27.80 },
  { latitude: -26.21, longitude: 27.82 },
  { latitude: -26.19, longitude: 27.82 },
  { latitude: -26.19, longitude: 27.80 },
];

test('Overpass query is constrained to the explicit project polygon', () => {
  const query = buildOverpassRoadQuery(boundary);
  assert.match(query, /way\["highway"\]\(poly:/);
  assert.match(query, /-26\.21 27\.8/);
  assert.match(query, /out meta geom;/);
  assert.doesNotMatch(query, /bbox/);
});

test('Overpass ways become detailed versioned project street geometry', () => {
  const segments = projectStreetSegmentsFromOverpass({
    workspaceId: 'workspace-a',
    projectId: 'project-a',
    boundary,
    response: { elements: [{
      type: 'way', id: 42, version: 7, timestamp: '2026-09-16T12:00:00Z', tags: { highway: 'residential', name: 'Example Street' },
      geometry: [{ lat: -26.2, lon: 27.801 }, { lat: -26.1995, lon: 27.802 }, { lat: -26.199, lon: 27.804 }],
    }] },
  });
  assert.equal(segments.length, 1);
  assert.equal(segments[0]?.geometry.length, 3);
  assert.equal(segments[0]?.source.provider, 'openstreetmap');
  assert.equal(segments[0]?.source.sourceVersion, '7@2026-09-16T12:00:00Z');
  assert.ok((segments[0]?.lengthMetres ?? 0) > 5);
});

test('ineligible road classes and geometry outside the project are excluded', () => {
  const segments = projectStreetSegmentsFromOverpass({
    workspaceId: 'workspace-a', projectId: 'project-a', boundary,
    response: { elements: [
      { type: 'way', id: 1, tags: { highway: 'motorway' }, geometry: [{ lat: -26.2, lon: 27.801 }, { lat: -26.2, lon: 27.802 }] },
      { type: 'way', id: 2, tags: { highway: 'residential' }, geometry: [{ lat: -27, lon: 28 }, { lat: -27.1, lon: 28.1 }] },
    ] },
  });
  assert.deepEqual(segments, []);
});
