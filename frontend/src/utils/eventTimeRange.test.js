import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesEventTimeRange as matches } from './eventTimeRange.js';

test('date-only range includes the entire final day', () => {
  assert.equal(matches('2026-10-14T23:59:59.999', '2026-10-14', '2026-10-14', '', ''), true);
  assert.equal(matches('2026-10-15T00:00:00', '', '2026-10-14', '', ''), false);
});
test('minute bounds include seconds in the selected end minute', () => {
  const check = value => matches(value, '2026-10-14', '2026-10-14', '09:30', '10:00');
  assert.equal(check('2026-10-14T09:29:59'), false);
  assert.equal(check('2026-10-14T09:30:00'), true);
  assert.equal(check('2026-10-14T10:00:59'), true);
  assert.equal(check('2026-10-14T10:01:00'), false);
});
test('date boundaries can span midnight', () => {
  assert.equal(matches('2026-10-15T00:15:00', '2026-10-14', '2026-10-15', '23:00', '01:00'), true);
});
test('time-only filters apply on any date and empty filters include missing dates', () => {
  assert.equal(matches('2026-10-13T09:45:00', '', '', '09:00', '10:00'), true);
  assert.equal(matches('2026-10-14T11:00:00', '', '', '09:00', '10:00'), false);
  assert.equal(matches(null, '', '', '', ''), true);
  assert.equal(matches(null, '', '', '09:00', ''), false);
});
