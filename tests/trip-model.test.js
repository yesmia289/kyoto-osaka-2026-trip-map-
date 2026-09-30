import test from 'node:test';
import assert from 'node:assert/strict';

import { ITINERARY_DAYS } from '../itinerary-data.js';
import {
  buildAmapRouteUrl,
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

test('navigation URL uses explicit HTTPS link or AMap coordinate fallback', () => {
  assert.equal(
    buildNavigationUrl({ navigationUrl: 'https://maps.google.com/?q=Kyoto' }),
    'https://maps.google.com/?q=Kyoto',
  );
  const url = new URL(buildNavigationUrl({ name: '京都站', coordinates: [34.985849, 135.758767] }));
  assert.equal(url.origin + url.pathname, 'https://uri.amap.com/marker');
  assert.equal(url.searchParams.get('position'), '135.758767,34.985849');
  assert.equal(url.searchParams.get('name'), '京都站');
  assert.equal(url.searchParams.get('coordinate'), 'wgs84');
  assert.equal(url.searchParams.get('callnative'), '1');
  assert.equal(buildNavigationUrl({ name: '未定地点' }), '');
});

test('AMap route URLs describe an adjacent pair and selected travel mode', () => {
  const from = { id: 'kyoto-station', name: '京都站', coordinates: [34.985849, 135.758767] };
  const to = { id: 'kyoto-hotel', name: 'GLANSIT 京都河原町', coordinates: [35.00455, 135.76955] };
  const url = new URL(buildAmapRouteUrl(from, to, 'bus'));

  assert.equal(url.origin + url.pathname, 'https://uri.amap.com/navigation');
  assert.equal(url.searchParams.get('from'), '135.758767,34.985849,京都站');
  assert.equal(url.searchParams.get('to'), '135.76955,35.00455,GLANSIT 京都河原町');
  assert.equal(url.searchParams.get('mode'), 'bus');
  assert.equal(url.searchParams.get('callnative'), '1');
  assert.equal(buildAmapRouteUrl(from, { name: '未定地点' }, 'walk'), '');
  assert.equal(buildAmapRouteUrl(from, { name: '越界', coordinates: [91, 135] }, 'walk'), '');
  assert.equal(buildAmapRouteUrl(from, { name: '越界', coordinates: [35, 181] }, 'walk'), '');
});

test('day view inserts one navigation leg between every adjacent itinerary item', () => {
  const view = buildDayView({
    id: 'route-cards',
    stops: [
      { id: 'a', name: '起点', coordinates: [35, 135] },
      { id: 'b', name: '中间点', coordinates: [35.1, 135.1] },
      { id: 'c', name: '待定地点' },
    ],
    route: ['a', 'b', 'c'],
  });

  assert.equal(view.stops[0].nextLeg.toName, '中间点');
  assert.match(view.stops[0].nextLeg.busUrl, /mode=bus/);
  assert.match(view.stops[0].nextLeg.walkUrl, /mode=walk/);
  assert.equal(view.stops[0].nextLeg.available, true);
  assert.equal(view.stops[1].nextLeg.toName, '待定地点');
  assert.equal(view.stops[1].nextLeg.available, false);
  assert.equal(view.stops[2].nextLeg, undefined);
});

test('mappable stops keep their rendered sequence for numbered markers', () => {
  const view = buildDayView(getDayById('d3'));

  assert.equal(view.mappableStops[0].id, 'nanzenji');
  assert.equal(view.mappableStops[0].sequence, 1);
});

test('Day 1 timeline begins with HB340 even though the flight is not mapped', () => {
  const view = buildDayView(getDayById('d1'));

  assert.equal(view.stops[0].id, 'hb340');
  assert.equal(view.mappableStops[0].id, 'kix-arrival');
});

test('unconfirmed kimono activities do not expose fake hotel coordinates or navigation', () => {
  const day = buildDayView(getDayById('d2'));
  const fitting = day.stops.find((stop) => stop.id === 'kyoto-hotel-start');
  const returnStop = day.stops.find((stop) => stop.id === 'kyoto-hotel-return');

  for (const stop of [fitting, returnStop]) {
    assert.equal(stop.coordinates, undefined);
    assert.equal(stop.navigationUrl, '');
  }
});
