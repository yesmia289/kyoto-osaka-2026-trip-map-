import test from 'node:test';
import assert from 'node:assert/strict';

import { startStaticServer } from './helpers/static-server.js';

test('the static site serves its accessible shell and module assets', async (t) => {
  const server = await startStaticServer(new URL('..', import.meta.url));
  t.after(() => server.close());

  const paths = ['/', '/leaflet-base.css', '/styles.css', '/app.js', '/itinerary-data.js'];
  const responses = await Promise.all(paths.map((path) => fetch(`${server.origin}${path}`)));

  for (const response of responses) assert.equal(response.status, 200);

  const html = await responses[0].text();
  assert.match(html, /<main[^>]+aria-label="京都大阪六日行程"/);
  assert.match(html, /<script type="module" src="app\.js"><\/script>/);
  assert.match(html, /id="map"/);
  assert.match(html, /id="itinerary-sheet"/);
});
