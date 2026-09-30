import test from 'node:test';
import assert from 'node:assert/strict';

import { ITINERARY_DAYS } from '../itinerary-data.js';
import { createInitialState, selectDay, selectStop } from '../trip-model.js';

test('initial state selects the first day and its first stop', () => {
  const state = createInitialState(ITINERARY_DAYS);

  assert.equal(state.dayId, 'd1');
  assert.equal(state.stopId, 'hb340');
  assert.equal(state.sheetExpanded, false);
});

test('selecting D4 resets stop selection to the first D4 stop', () => {
  const initial = createInitialState(ITINERARY_DAYS);
  const withAnotherStop = selectStop(initial, 'joyo-fireworks');
  const selected = selectDay(withAnotherStop, 'd4');

  assert.equal(selected.dayId, 'd4');
  assert.equal(selected.stopId, 'kyoto-hotel-checkout');
});

test('selecting a missing day preserves the current state object', () => {
  const initial = createInitialState(ITINERARY_DAYS);

  assert.equal(selectDay(initial, 'missing'), initial);
});

test('a day with no coordinates remains selectable', () => {
  const days = [
    ...ITINERARY_DAYS,
    {
      id: 'text-only',
      date: '10月10日',
      title: '文字行程',
      stops: [{ id: 'note', name: '集合', time: '09:00' }],
      route: ['note'],
    },
  ];
  const selected = selectDay(createInitialState(days), 'text-only');

  assert.equal(selected.dayId, 'text-only');
  assert.equal(selected.stopId, 'note');
});
