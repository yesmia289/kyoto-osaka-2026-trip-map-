import test from 'node:test';
import assert from 'node:assert/strict';

import { ITINERARY_DAYS } from '../itinerary-data.js';
import {
  buildDayView,
  buildNavigationUrl,
  getDayById,
  getMappableStops,
} from '../trip-model.js';

test('six-day itinerary preserves confirmed trip order and flight details', () => {
  assert.deepEqual(ITINERARY_DAYS.map((day) => day.id), ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']);
  assert.equal(ITINERARY_DAYS.length, 6);
  assert.match(JSON.stringify(getDayById('d1')), /HB340/);
  assert.match(JSON.stringify(getDayById('d6')), /UO863/);
  assert.match(JSON.stringify(getDayById('d1')), /备选・未购票/);
  assert.match(JSON.stringify(getDayById('d2')), /18:00前/);
  assert.match(JSON.stringify(getDayById('d5')), /日本环球影城/);
});

test('Day 4 visits Uji before retrieving luggage and reaching Osaka', () => {
  const stopIds = getDayById('d4').stops.map((stop) => stop.id);
  assert.ok(stopIds.indexOf('byodoin') < stopIds.indexOf('kyoto-hotel-pickup'));
  assert.ok(stopIds.indexOf('kyoto-hotel-pickup') < stopIds.indexOf('osaka-hotel'));
});

test('public links are HTTPS and private booking fields are absent', () => {
  const forbiddenFields = new Set(['bookingNumber', 'passport', 'phone', 'roomNumber', 'homeAddress']);

  for (const day of ITINERARY_DAYS) {
    for (const stop of day.stops) {
      for (const key of Object.keys(stop)) {
        assert.equal(forbiddenFields.has(key), false, `private field leaked: ${key}`);
      }
      for (const key of ['officialUrl', 'ticketUrl', 'navigationUrl']) {
        if (stop[key]) assert.equal(new URL(stop[key]).protocol, 'https:');
      }
    }
  }
});

test('a day without coordinates still builds a readable view', () => {
  const day = {
    id: 'text-only',
    date: '10月10日',
    title: '文字行程',
    city: '京都',
    summary: '地图不可用时仍可阅读',
    stops: [{ id: 'note', time: '09:00', name: '集合', summary: '酒店大厅' }],
    route: ['note'],
  };

  assert.deepEqual(getMappableStops(day), []);
  assert.deepEqual(buildDayView(day).stops.map((stop) => stop.id), ['note']);
});

test('navigation URL uses explicit HTTPS link or coordinate fallback', () => {
  assert.equal(
    buildNavigationUrl({ navigationUrl: 'https://maps.google.com/?q=Kyoto' }),
    'https://maps.google.com/?q=Kyoto',
  );
  assert.equal(
    buildNavigationUrl({ name: '京都站', coordinates: [34.985849, 135.758767] }),
    'https://www.google.com/maps/search/?api=1&query=34.985849%2C135.758767',
  );
  assert.equal(buildNavigationUrl({ name: '未定地点' }), '');
});
