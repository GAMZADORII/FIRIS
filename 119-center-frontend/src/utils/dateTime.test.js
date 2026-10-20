import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, formatClock, formatShortDateTime } from './dateTime.js';

test('rounds subsecond report timestamps consistently in all display formats', () => {
  const value = '2026-10-15T10:00:43.781464';
  assert.equal(formatDateTime(value), '2026-10-15 10:00:44');
  assert.equal(formatClock(value), '10:00:44');
  assert.equal(formatShortDateTime(value), '10.15 10:00:44');
  assert.equal(formatDateTime('2026-10-15 10:00:43.499999'), '2026-10-15 10:00:43');
  assert.equal(formatDateTime('2026-10-15T10:00:43.500000'), '2026-10-15 10:00:44');
});

test('rounding carries into the next minute and day; missing dates stay empty', () => {
  assert.equal(formatDateTime('2026-12-31T23:59:59.999999'), '2027-01-01 00:00:00');
  assert.equal(formatDateTime('2026-10-15T10:00:59.5'), '2026-10-15 10:01:00');
  assert.equal(formatDateTime(null), '—');
});