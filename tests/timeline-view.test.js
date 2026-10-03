import test from 'node:test';
import assert from 'node:assert/strict';

import { ITINERARY_DAYS } from '../itinerary-data.js';
import { insertStopAfter, loadSavedItinerary, serializeItinerary } from '../editor-model.js';
import { buildDayView, getDayById } from '../trip-model.js';
import { isTimelineLinkTarget, renderTimelineHtml } from '../timeline-view.js';

test('D3 renders one Google Maps navigation card between every adjacent stop', () => {
  const day = buildDayView(getDayById('d3'));
  const html = renderTimelineHtml(day, day.stops[0].id);

  assert.equal((html.match(/<section class="route-leg(?: is-unavailable)?"/g) || []).length, 10);
  assert.match(html, /www\.google\.com\/maps\/dir/);
  assert.match(html, /travelmode=transit/);
  assert.match(html, /travelmode=walking/);
  assert.match(html, /公共交通/);
});

test('missing coordinates render an informational group without false links or nav landmark', () => {
  const day = buildDayView(getDayById('d1'));
  const html = renderTimelineHtml(day, day.stops[0].id);
  const firstLeg = html.match(/<section class="route-leg is-unavailable"[\s\S]*?<\/section>/)?.[0] || '';

  assert.match(firstLeg, /补充起点和终点坐标后可导航/);
  assert.doesNotMatch(firstLeg, /<a\b/);
  assert.doesNotMatch(firstLeg, /<nav\b/);
});

test('hostile stop labels are escaped in cards and accessible labels', () => {
  const day = buildDayView({
    id: 'unsafe',
    stops: [
      { id: 'a', name: '<img src=x onerror=alert(1)>', coordinates: [35, 135] },
      { id: 'b', name: '安全终点', coordinates: [35.1, 135.1] },
    ],
    route: ['a', 'b'],
  });
  const html = renderTimelineHtml(day, 'a');

  assert.doesNotMatch(html, /<img\b/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('route link targets are isolated from timeline item selection', () => {
  assert.equal(isTimelineLinkTarget({ closest: (selector) => selector === 'a' ? {} : null }), true);
  assert.equal(isTimelineLinkTarget({ closest: () => null }), false);
  assert.equal(isTimelineLinkTarget(null), false);
});

test('saved browser edits derive new route cards after reload', () => {
  const edited = insertStopAfter(ITINERARY_DAYS, 'd3', 'eikando', {
    name: '咖啡休息',
    latitude: '35.016',
    longitude: '135.796',
  }, 'custom-coffee');
  const loaded = loadSavedItinerary(serializeItinerary(edited), ITINERARY_DAYS).days;
  const day = buildDayView(getDayById('d3', loaded));
  const html = renderTimelineHtml(day, 'custom-coffee');

  assert.equal((html.match(/<section class="route-leg(?: is-unavailable)?"/g) || []).length, 11);
  assert.match(html, /咖啡休息/);
});
