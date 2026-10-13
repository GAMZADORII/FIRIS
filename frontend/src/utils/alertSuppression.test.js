import test from 'node:test';
import assert from 'node:assert/strict';
import { hasActiveReport, keepManualAlerts, afterCompletedReports } from './alertSuppression.js';

test('any accepted ongoing report suppresses automatic alerts until all reports close', () => {
  for (const responseStatus of ['PENDING', 'DISPATCHED', 'ARRIVED']) {
    assert.equal(hasActiveReport([{ responseStatus: 'CLOSED' }, { responseStatus }]), true);
  }
  assert.equal(hasActiveReport([{ responseStatus: 'CLOSED' }]), false);
  assert.equal(hasActiveReport([]), false);
});

test('suppression removes automatic alerts but preserves manually opened history', () => {
  const manual = { eventId: 2, manualOpen: true };
  assert.deepEqual(keepManualAlerts([{ eventId: 1 }, manual, { eventId: 3 }]), [manual]);
});

test('events detected during handling do not reappear after completion', () => {
  const reports = [{ closedAt: '2026-10-13T12:00:00' }];
  assert.equal(afterCompletedReports({ detectedAt: '2026-10-13T11:59:59' }, reports), false);
  assert.equal(afterCompletedReports({ detectedAt: '2026-10-13T12:00:01' }, reports), true);
});
