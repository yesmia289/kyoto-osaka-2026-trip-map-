import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml } from '../html-utils.js';

test('HTML-looking place names render as literal tooltip text', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">咖啡店'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;咖啡店',
  );
});
