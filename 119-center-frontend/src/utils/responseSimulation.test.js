import test from 'node:test';
import assert from 'node:assert/strict';
import { reportMessageFields, isFireReportMessage } from '../api/mock119Contract.js';
import { makeDemoReports, transitionReport, updateDueArrivals, remainingSeconds, positionAlongRoute, ARRIVAL_DELAY_MS, isFirisUnconfirmed } from './responseSimulation.js';
test('dispatch arrives exactly 60 seconds after being accepted, even after reload',()=>{
  assert.equal(ARRIVAL_DELAY_MS, 60000);
  const report=makeDemoReports(0)[0];
  assert.equal(report.responseStatus,'PENDING');
  assert.equal(updateDueArrivals([report],99999999)[0].responseStatus,'PENDING');
  const dispatched=transitionReport(report,'DISPATCHED',2000);
  assert.equal(dispatched.dispatchAt,2000);
  assert.equal(dispatched.arrivalAt,62000);
  assert.equal(dispatched.history.filter(h=>h.status==='RECEIVED').length,1);
  assert.equal(remainingSeconds(dispatched,2000),60);
  assert.equal(updateDueArrivals([dispatched],61999)[0].responseStatus,'DISPATCHED');
  const restored=JSON.parse(JSON.stringify(dispatched));
  const arrived=updateDueArrivals([restored],62000)[0];
  assert.equal(arrived.responseStatus,'ARRIVED');
  assert.equal(arrived.history.filter(h=>h.status==='ARRIVED').length,1);
  assert.equal(updateDueArrivals([arrived],66000)[0].history.length,arrived.history.length);
});
test('manual arrival is blocked while dispatch is ongoing; completion requires arrival',()=>{
  const accepted=makeDemoReports(0)[0];
  assert.equal(transitionReport(accepted,'CLOSED',0),accepted);
  const dispatched=transitionReport(accepted,'DISPATCHED',0);
  assert.equal(transitionReport(dispatched,'ARRIVED',500),dispatched);
  assert.equal(transitionReport(dispatched,'CLOSED',500),dispatched);
  const arrived=updateDueArrivals([dispatched],60000)[0];
  assert.equal(isFirisUnconfirmed(accepted),true);
  assert.equal(isFirisUnconfirmed(dispatched),true);
  assert.equal(isFirisUnconfirmed(arrived),true);
  const completed=transitionReport(arrived,'CLOSED',61000);
  assert.equal(completed.responseStatus,'CLOSED');
  assert.equal(isFirisUnconfirmed(completed),false);
});
test('route interpolation remains within the static demo route',()=>{
  const points=[[0,0],[10,0],[10,30]];
  assert.deepEqual(positionAlongRoute(points,0),[0,0]);
  assert.deepEqual(positionAlongRoute(points,.5),[10,10]);
  assert.deepEqual(positionAlongRoute(points,1),[10,30]);
});

test('mock report fields match the FIRIS Backend FIRE_REPORT message shape', () => {
  const message = makeDemoReports(0)[0];
  assert.equal(isFireReportMessage(message), true);
  for (const field of reportMessageFields) {
    assert.notEqual(message[field], undefined, `Missing backend message field: ${field}`);
  }
  assert.equal(message.eventType, 'FIRE_SMOKE');
  assert.equal(message.detailLocation, '1층 생산라인 A');
  assert.equal(message.responseStatus, 'PENDING');
});
