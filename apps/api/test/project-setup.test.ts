import assert from 'node:assert/strict';
import test from 'node:test';
import { polygonAreaSquareKm, ProjectSetupValidationError, validateProjectAssignment, validateProjectSetup } from '../src/project-setup.js';

test('validates a practical development capture polygon', () => {
  const result = validateProjectSetup({
    name: 'Local Store Capture Test', areaName: 'Home test block',
    timeZone: 'Africa/Johannesburg', formTemplateId: 'STANDARD_FMCG', questions: [],
    boundary: [
      { latitude: -26.200, longitude: 28.000 }, { latitude: -26.200, longitude: 28.005 },
      { latitude: -26.205, longitude: 28.005 }, { latitude: -26.205, longitude: 28.000 },
    ],
  });
  assert.equal(result.name, 'Local Store Capture Test');
  assert.ok(result.areaSquareKm > 0.2 && result.areaSquareKm < 0.4);
});

test('rejects boundaries that cannot form an area', () => {
  assert.throws(() => validateProjectSetup({ name: 'Test project', areaName: 'Test area', timeZone: 'Africa/Johannesburg', formTemplateId: 'STANDARD_FMCG', questions: [], boundary: [{ latitude: 1, longitude: 1 }, { latitude: 1, longitude: 2 }] }), ProjectSetupValidationError);
});

test('rejects an excessively broad development polygon', () => {
  assert.throws(() => validateProjectSetup({
    name: 'Test project', areaName: 'Test area',
    timeZone: 'Africa/Johannesburg', formTemplateId: 'STANDARD_FMCG', questions: [],
    boundary: [{ latitude: -26, longitude: 27 }, { latitude: -26, longitude: 28 }, { latitude: -27, longitude: 28 }, { latitude: -27, longitude: 27 }],
  }), /may not exceed 100 km/);
});

test('validates an area timezone and custom select question', () => {
  const result = validateProjectSetup({
    name: 'Lagos retail audit', areaName: 'Ikeja test area', timeZone: 'Africa/Lagos', formTemplateId: 'CUSTOM',
    questions: [{ id: 'storeType', label: 'Store type', type: 'select', required: true, options: ['Kiosk', 'Supermarket'] }],
    boundary: [{ latitude: 6.60, longitude: 3.34 }, { latitude: 6.60, longitude: 3.35 }, { latitude: 6.59, longitude: 3.35 }, { latitude: 6.59, longitude: 3.34 }],
  });
  assert.equal(result.timeZone, 'Africa/Lagos');
  assert.equal(result.questions[0]?.options[1], 'Supermarket');
});

test('rejects invalid timezones and incomplete select questions', () => {
  const boundary = [{ latitude: -26.2, longitude: 28 }, { latitude: -26.2, longitude: 28.01 }, { latitude: -26.21, longitude: 28.01 }];
  assert.throws(() => validateProjectSetup({ name: 'Test project', areaName: 'Test area', timeZone: 'Africa/Nowhere', questions: [], boundary }), /timezone/);
  assert.throws(() => validateProjectSetup({ name: 'Test project', areaName: 'Test area', timeZone: 'Africa/Johannesburg', questions: [{ id: 'channel', label: 'Channel', type: 'select', options: ['Only one'] }], boundary }), /at least two/);
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
