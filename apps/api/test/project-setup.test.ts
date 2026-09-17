import assert from 'node:assert/strict';
import test from 'node:test';
import { polygonAreaSquareKm, ProjectSetupValidationError, validateProjectAssignment, validateProjectSetup } from '../src/project-setup.js';

test('validates a practical development capture polygon', () => {
  const result = validateProjectSetup({
    name: 'Local Store Capture Test', areaName: 'Home test block',
    boundary: [
      { latitude: -26.200, longitude: 28.000 }, { latitude: -26.200, longitude: 28.005 },
      { latitude: -26.205, longitude: 28.005 }, { latitude: -26.205, longitude: 28.000 },
    ],
  });
  assert.equal(result.name, 'Local Store Capture Test');
  assert.ok(result.areaSquareKm > 0.2 && result.areaSquareKm < 0.4);
});

test('rejects boundaries that cannot form an area', () => {
  assert.throws(() => validateProjectSetup({ name: 'Test project', areaName: 'Test area', boundary: [{ latitude: 1, longitude: 1 }, { latitude: 1, longitude: 2 }] }), ProjectSetupValidationError);
});

test('rejects an excessively broad development polygon', () => {
  assert.throws(() => validateProjectSetup({
    name: 'Test project', areaName: 'Test area',
    boundary: [{ latitude: -26, longitude: 27 }, { latitude: -26, longitude: 28 }, { latitude: -27, longitude: 28 }, { latitude: -27, longitude: 27 }],
  }), /may not exceed 100 km/);
});

test('polygon area is independent of clockwise ordering', () => {
  const boundary = [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.01 }, { latitude: 0.01, longitude: 0.01 }];
  assert.equal(polygonAreaSquareKm(boundary), polygonAreaSquareKm([...boundary].reverse()));
});

test('validates a project assignment to a Firebase identity', () => {
  assert.deepEqual(validateProjectAssignment({ userId: '0QOnrLKulpcuBgNouOoFLEaDdKf1', areaName: 'New test block' }), { userId: '0QOnrLKulpcuBgNouOoFLEaDdKf1', areaName: 'New test block' });
});

test('rejects malformed capturer assignment input', () => {
  assert.throws(() => validateProjectAssignment({ userId: '../wrong', areaName: '' }), ProjectSetupValidationError);
});
