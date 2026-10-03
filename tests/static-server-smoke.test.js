import test from 'node:test';
import assert from 'node:assert/strict';

import { startStaticServer } from './helpers/static-server.js';

test('the static site serves its accessible shell and module assets', async (t) => {
  const server = await startStaticServer(new URL('..', import.meta.url));
  t.after(() => server.close());

  const paths = [
    '/', '/leaflet-base.css', '/styles.css', '/app.js', '/itinerary-data.js',
    '/editor-model.js', '/html-utils.js', '/trip-model.js', '/focus-management.js', '/timeline-view.js',
  ];
  const responses = await Promise.all(paths.map((path) => fetch(`${server.origin}${path}`)));

  for (const response of responses) assert.equal(response.status, 200);

  const publicSource = (await Promise.all(responses.map((response) => response.clone().text()))).join('\n');

  const html = await responses[0].text();
  const css = await responses[2].text();
  const app = await responses[3].text();
  assert.match(html, /<main[^>]+aria-label="京都大阪六日行程"/);
  assert.match(html, /<script type="module" src="app\.js"><\/script>/);
  assert.match(html, /<script[^>]+id="leaflet-script"[^>]+async/);
  assert.match(app, /tile\.openstreetmap\.org/);
  assert.ok(
    html.indexOf('type="module" src="app.js"') < html.indexOf('id="leaflet-script"'),
    'the text itinerary module must not wait for Leaflet',
  );
  assert.match(css, /\.sheet-handle\s*\{[^}]*touch-action:\s*none/s);
  assert.match(css, /\.day-tab\[aria-current="date"\]/);
  assert.doesNotMatch(css, /\.day-tab\[aria-selected="true"\]/);
  assert.match(css, /\.route-leg/);
  assert.match(css, /\.route-leg__actions \.stop-link\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.leaflet-bottom\.leaflet-right\s*\{[^}]*top:/s);
  assert.match(css, /\.leaflet-bottom\.leaflet-right\s*\{[^}]*bottom:\s*auto/s);
  assert.match(css, /@media \(max-height: 720px\)[\s\S]*?\.leaflet-bottom\.leaflet-right\s*\{[^}]*top:[^;}]*!important/s);
  assert.doesNotMatch(publicSource, /sg-webapi\.opnavi\.com/);
  assert.doesNotMatch(publicSource, /securityJsCode|_AMapSecurityConfig/);
  assert.doesNotMatch(publicSource, /webapi\.amap\.com\/maps[^"'\s]*[?&]key=/);
  assert.doesNotMatch(publicSource, /maps\.googleapis\.com/);
  assert.match(app, /captureInteractiveFocus/);
  assert.match(app, /restoreInteractiveFocus/);
  assert.match(html, /id="map"/);
  assert.match(html, /id="itinerary-sheet"/);
  assert.match(html, /id="edit-toggle"/);
  assert.match(html, /id="editor-toolbar"/);
  assert.match(html, /<dialog[^>]+id="stop-editor"/);
  assert.match(app, /renderTimelineHtml/);
  assert.match(publicSource, /buildGoogleMapsRouteUrl|nextLeg/);
});
