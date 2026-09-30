import test from 'node:test';
import assert from 'node:assert/strict';

import { ITINERARY_DAYS } from '../itinerary-data.js';
import {
  deleteStop,
  insertStopAfter,
  loadSavedItinerary,
  parseSavedItinerary,
  saveItineraryToStorage,
  serializeItinerary,
  updateStop,
} from '../editor-model.js';

test('a new stop is inserted after the selected stop in both timeline and route', () => {
  const result = insertStopAfter(ITINERARY_DAYS, 'd3', 'nanzenji', {
    time: '11:00',
    name: '咖啡休息',
    summary: '哲学之道附近',
    latitude: '35.016',
    longitude: '135.796',
  }, 'custom-coffee');
  const day = result.find((candidate) => candidate.id === 'd3');

  const expectedStart = ['kyoto-hotel-d3-start', 'tenjuan', 'eikando', 'nanzenji', 'custom-coffee'];
  assert.deepEqual(day.route.slice(0, 5), expectedStart);
  assert.deepEqual(day.stops.slice(0, 5).map((stop) => stop.id), expectedStart);
  assert.deepEqual(day.stops.find((stop) => stop.id === 'custom-coffee').coordinates, [35.016, 135.796]);
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
  const stop = result.find((day) => day.id === 'd3').stops.find((candidate) => candidate.id === 'nanzenji');

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

test('incomplete coordinates are rejected instead of silently deleting the location', () => {
  assert.throws(
    () => insertStopAfter(ITINERARY_DAYS, 'd2', 'togetsukyo', {
      name: '临时地点',
      latitude: '35.1',
      longitude: '',
    }, 'custom-location'),
    /纬度和经度需要同时填写/,
  );
});

test('non-HTTPS links are rejected instead of silently deleting the link', () => {
  assert.throws(
    () => insertStopAfter(ITINERARY_DAYS, 'd2', 'togetsukyo', {
      name: '临时地点',
      officialUrl: 'http://example.com',
    }, 'custom-link'),
    /官方信息链接必须使用 https:\/\//,
  );
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

test('schema-valid JSON with corrupt day or stop records falls back safely', () => {
  const corruptStop = JSON.parse(serializeItinerary(ITINERARY_DAYS));
  corruptStop.days[0].stops[1] = null;
  const corruptDay = JSON.parse(serializeItinerary(ITINERARY_DAYS));
  delete corruptDay.days[0].date;
  const unsafeLink = JSON.parse(serializeItinerary(ITINERARY_DAYS));
  unsafeLink.days[0].stops[0].officialUrl = 'javascript:alert(1)';

  for (const payload of [corruptStop, corruptDay, unsafeLink]) {
    const loaded = loadSavedItinerary(JSON.stringify(payload), ITINERARY_DAYS);
    assert.equal(loaded.valid, false);
    assert.deepEqual(loaded.days, ITINERARY_DAYS);
  }
});

test('duplicate stop ids and route references outside the day fall back safely', () => {
  const duplicate = JSON.parse(serializeItinerary(ITINERARY_DAYS));
  duplicate.days[0].stops[1].id = duplicate.days[0].stops[0].id;
  const missingRouteTarget = JSON.parse(serializeItinerary(ITINERARY_DAYS));
  missingRouteTarget.days[0].route[0] = 'not-a-stop';

  assert.equal(loadSavedItinerary(JSON.stringify(duplicate), ITINERARY_DAYS).valid, false);
  assert.equal(loadSavedItinerary(JSON.stringify(missingRouteTarget), ITINERARY_DAYS).valid, false);
});

test('storage failure is returned to the caller instead of claiming persistence', () => {
  const failingStorage = {
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  const successfulStorage = {
    value: '',
    setItem(_key, value) {
      this.value = value;
    },
  };

  assert.equal(saveItineraryToStorage(failingStorage, ITINERARY_DAYS), false);
  assert.equal(saveItineraryToStorage(successfulStorage, ITINERARY_DAYS), true);
  assert.match(successfulStorage.value, /"version": 1/);
});

test('blank stop names are rejected', () => {
  assert.throws(
    () => insertStopAfter(ITINERARY_DAYS, 'd1', 'hb340', { name: '   ' }, 'custom-empty'),
    /请输入地点或项目名称/,
  );
});
