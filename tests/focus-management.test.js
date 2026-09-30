import test from 'node:test';
import assert from 'node:assert/strict';

import { captureInteractiveFocus, restoreInteractiveFocus } from '../focus-management.js';

function makeRoot(button) {
  return {
    contains(candidate) {
      return candidate === button;
    },
    querySelector(selector) {
      return selector.includes(button.dataset.dayId || button.dataset.stopId) ? button : null;
    },
  };
}

test('day selection focus is restored to the replacement day button', () => {
  let focusOptions;
  const button = {
    dataset: { dayId: 'd4' },
    closest(selector) {
      return selector === '[data-day-id]' ? this : null;
    },
    focus(options) {
      focusOptions = options;
    },
  };
  const dayTabs = makeRoot(button);
  const token = captureInteractiveFocus(button, dayTabs, makeRoot({ dataset: {} }));

  assert.deepEqual(token, { kind: 'day', id: 'd4' });
  assert.equal(restoreInteractiveFocus(token, dayTabs, makeRoot({ dataset: {} })), true);
  assert.deepEqual(focusOptions, { preventScroll: true });
});

test('timeline selection focus is restored to the replacement stop button', () => {
  let focused = false;
  const item = {
    dataset: { stopId: 'ginkakuji' },
    closest(selector) {
      return selector === '[data-stop-id]' ? this : null;
    },
    focus() {
      focused = true;
    },
  };
  const timeline = makeRoot(item);
  const token = captureInteractiveFocus(item, makeRoot({ dataset: {} }), timeline);

  assert.deepEqual(token, { kind: 'stop', id: 'ginkakuji' });
  restoreInteractiveFocus(token, makeRoot({ dataset: {} }), timeline);
  assert.equal(focused, true);
});
