import test from 'node:test';
import assert from 'node:assert/strict';

import { ITINERARY_DAYS } from '../itinerary-data.js';
import {
  deleteStop,
  insertStopAfter,
  parseSavedItinerary,
  serializeItinerary,
  updateStop,
} from '../editor-model.js';

test('a new stop is inserted after the selected stop in both timeline and route', () => {
  const result = insertStopAfter(ITINERARY_DAYS, 'd3', 'eikando', {
    time: '11:00',
    name: '咖啡休息',
    summary: '哲学之道附近',
    latitude: '35.016',
    longitude: '135.796',
  }, 'custom-coffee');
  const day = result.find((candidate) => candidate.id === 'd3');

  assert.deepEqual(day.route.slice(0, 4), ['nanzenji', 'eikando', 'custom-coffee', 'philosophers-path-south']);
  assert.deepEqual(day.stops.slice(0, 4).map((stop) => stop.id), ['nanzenji', 'eikando', 'custom-coffee', 'philosophers-path-south']);
  assert.deepEqual(day.stops[2].coordinates, [35.016, 135.796]);
  assert.equal(ITINERARY_DAYS[2].stops.some((stop) => stop.id === 'custom-coffee'), false);
});

test('editing a stop preserves its id and removes cleared optional location fields', () => {
  const result = updateStop(ITINERARY_DAYS, 'd3', 'nanzenji', {
    time: '09:30',
    name: '南禅寺慢游',
    summary: '',
    detail: '晚一点出发',
    latitude: '',
    longitude: '',
    officialUrl: '',
    navigationUrl: '',
  });
  const stop = result.find((day) => day.id === 'd3').stops[0];

  assert.equal(stop.id, 'nanzenji');
  assert.equal(stop.name, '南禅寺慢游');
  assert.equal(stop.time, '09:30');
  assert.equal(stop.detail, '晚一点出发');
  assert.equal('coordinates' in stop, false);
  assert.equal('officialUrl' in stop, false);
});

test('deleting a stop removes it from both timeline and route without mutating defaults', () => {
  const result = deleteStop(ITINERARY_DAYS, 'd5', 'usj');
  const day = result.find((candidate) => candidate.id === 'd5');

  assert.deepEqual(day.stops.map((stop) => stop.id), ['osaka-hotel-start']);
  assert.deepEqual(day.route, ['osaka-hotel-start']);
  assert.equal(ITINERARY_DAYS[4].stops.some((stop) => stop.id === 'usj'), true);
});

test('unsafe URLs and incomplete coordinates are not saved', () => {
  const result = insertStopAfter(ITINERARY_DAYS, 'd2', 'togetsukyo', {
    name: '临时地点',
    latitude: '35.1',
    longitude: '',
    officialUrl: 'javascript:alert(1)',
    navigationUrl: 'http://example.com',
  }, 'custom-safe');
  const stop = result.find((day) => day.id === 'd2').stops.find((candidate) => candidate.id === 'custom-safe');

  assert.equal('coordinates' in stop, false);
  assert.equal('officialUrl' in stop, false);
  assert.equal('navigationUrl' in stop, false);
});

test('saved itinerary round-trips and malformed storage falls back to a clean copy', () => {
  const edited = insertStopAfter(ITINERARY_DAYS, 'd6', 'dotonbori', { name: '章鱼烧加餐' }, 'custom-snack');
  const serialized = serializeItinerary(edited, '2026-10-01T00:00:00.000Z');
  const parsed = parseSavedItinerary(serialized, ITINERARY_DAYS);

  assert.equal(parsed.find((day) => day.id === 'd6').route.includes('custom-snack'), true);
  assert.match(serialized, /"version": 1/);
  assert.match(serialized, /"updatedAt": "2026-10-01T00:00:00.000Z"/);

  const fallback = parseSavedItinerary('{broken', ITINERARY_DAYS);
  assert.deepEqual(fallback, ITINERARY_DAYS);
  assert.notEqual(fallback, ITINERARY_DAYS);
});

test('blank stop names are rejected', () => {
  assert.throws(
    () => insertStopAfter(ITINERARY_DAYS, 'd1', 'hb340', { name: '   ' }, 'custom-empty'),
    /请输入地点或项目名称/,
  );
});
