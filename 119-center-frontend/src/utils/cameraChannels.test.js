import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraChannelSlots, cameraDisplayName } from './cameraChannels.js';
test('center camera zones match the main FIRIS display order', () => {
  assert.deepEqual(cameraChannelSlots.map(([id]) => id), ['CAM001','CAM002','CAM005','CAM006','CAM007','CAM003','CAM004','CAM008','CAM009']);
  assert.deepEqual(cameraChannelSlots.map(([,zone]) => zone), ['공장 A구역','공장 B구역','공장 C구역','공장 D구역','공장 E구역','창고 A구역','창고 B구역','창고 C구역','창고 D구역']);
  assert.equal(cameraDisplayName('CAM005'), 'CCTV 03');
  assert.equal(cameraDisplayName('CAM003'), 'CCTV 06');
  assert.equal(cameraDisplayName('CAM008'), 'CCTV 08');
  assert.equal(cameraDisplayName('CAM_UNKNOWN'), 'CAM_UNKNOWN');
});
