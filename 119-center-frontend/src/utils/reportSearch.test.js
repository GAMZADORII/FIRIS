import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesReportSearch } from './reportSearch.js';

test('search accepts visible report number, display channel, internal ID and location', () => {
  const report = {reportId:29,cameraId:'CAM003',facility:'FIRIS 스마트공장',detailLocation:'창고 A구역'};
  for (const query of ['119-029','29','CCTV 06',' cctv06 ','CAM003','창고 A구역','FIRIS']) {
    assert.equal(matchesReportSearch(report,query),true,query);
  }
  assert.equal(matchesReportSearch(report,'CCTV 03'),false);
  assert.equal(matchesReportSearch(report,'119-099'),false);
  assert.equal(matchesReportSearch(report,''),true);
});