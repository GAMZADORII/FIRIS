// Display order is independent of the stable camera IDs used by AI, events, and storage.
export const cameraChannelSlots = [
  ['CAM001', '공장 A구역'], ['CAM002', '공장 B구역'], ['CAM005', '공장 C구역'],
  ['CAM006', '공장 D구역'], ['CAM007', '공장 E구역'], ['CAM003', '창고 A구역'],
  ['CAM004', '창고 B구역'], ['CAM008', '창고 C구역'], ['CAM009', '창고 D구역'],
];

export const cameraChannelOrder = cameraChannelSlots.map(([cameraId]) => cameraId);

const channelByCameraId = new Map(cameraChannelOrder.map((cameraId, index) => [cameraId, index + 1]));

export function cameraChannelNumber(cameraId) {
  return channelByCameraId.get(cameraId) ?? null;
}

export function cameraDisplayName(cameraId, fallback) {
  const number = cameraChannelNumber(cameraId);
  return number == null ? (fallback || cameraId || 'CCTV') : `CCTV ${String(number).padStart(2, '0')}`;
}
