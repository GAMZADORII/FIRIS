import test from 'node:test';
import assert from 'node:assert/strict';
import { paginatePendingReports } from './intakePagination.js';
const report = (id, status = 'PENDING') => ({reportId: id, responseStatus: status, reportedAt: '2026-10-15T12:00:00'});

test('all pending reports remain reachable beyond the first five; completed reports stay out', () => {
  const reports = [report(1),report(7),report(4),report(3),report(2),report(6),report(5),report(8,'CLOSED')];
  const first = paginatePendingReports(reports, 1);
  const second = paginatePendingReports(reports, 2);
  assert.equal(first.total, 7);
  assert.equal(first.pageCount, 2);
  assert.deepEqual(first.reports.map(r => r.reportId), [7,6,5,4,3]);
  assert.deepEqual(second.reports.map(r => r.reportId), [2,1]);
  assert.equal(reports[0].reportId, 1);
});

test('completion of the last page returns to a valid page; all completed leaves no selection', () => {
  const closedLastPage = [report(7),report(6),report(5),report(4),report(3),report(2,'CLOSED'),report(1,'CLOSED')];
  assert.equal(paginatePendingReports(closedLastPage,2).page,1);
  const empty = paginatePendingReports(closedLastPage.map(r => ({...r,responseStatus:'CLOSED'})),2);
  assert.equal(empty.page,1);
  assert.equal(empty.total,0);
  assert.deepEqual(empty.reports,[]);
});