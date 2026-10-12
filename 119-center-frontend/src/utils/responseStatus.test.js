import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingSeconds, responseProgress } from './responseStatus.js';

test('server deadline countdown never mutates the response status', () => {
  const report = { responseStatus: 'DISPATCHED', dispatchAt: 1000, arrivalAt: 61000 };
  assert.equal(remainingSeconds(report, 31000), 30);
  assert.equal(remainingSeconds(report, 100000), 0);
  assert.equal(report.responseStatus, 'DISPATCHED');
  assert.equal(responseProgress(report, 31000), 0.5);
});
test('missing or invalid server timestamps do not invent progress', () => {
  assert.equal(responseProgress({ responseStatus: 'PENDING' }, 0), 0);
  assert.equal(responseProgress({ responseStatus: 'DISPATCHED' }, 0), 0);
  assert.equal(responseProgress({ responseStatus: 'DISPATCHED', dispatchAt: 1000, arrivalAt: 1000 }, 2000), 0);
  assert.equal(responseProgress({ responseStatus: 'CLOSED' }, 0), 1);
});
