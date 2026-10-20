export const responseStatusLabels = {
  PENDING: '신규 신고', DISPATCHED: '출동 중', ARRIVED: '현장 도착', CLOSED: '대응 완료',
};
export const responseSteps = [
  ['PENDING', '신규 신고'], ['DISPATCHED', '출동'], ['ARRIVED', '도착'], ['CLOSED', '대응 완료'],
];
export const remainingSeconds = (r, now) => r.responseStatus === 'DISPATCHED' && Number.isFinite(r.arrivalAt)
  ? Math.max(0, Math.ceil((r.arrivalAt - now) / 1000)) : 0;
export function responseProgress(r, now) {
  if (['ARRIVED', 'CLOSED'].includes(r.responseStatus)) return 1;
  if (r.responseStatus !== 'DISPATCHED' || !Number.isFinite(r.dispatchAt) ||
      !Number.isFinite(r.arrivalAt) || r.arrivalAt <= r.dispatchAt) return 0;
  return Math.min(1, Math.max(0, (now - r.dispatchAt) / (r.arrivalAt - r.dispatchAt)));
}

export const routeProgress = responseProgress;
export function positionAlongRoute(points, progress) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let remaining = lengths.reduce((a, b) => a + b, 0) * Math.min(1, Math.max(0, progress));
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const ratio = lengths[i] ? remaining / lengths[i] : 0;
      return [points[i][0] + (points[i+1][0] - points[i][0]) * ratio, points[i][1] + (points[i+1][1] - points[i][1]) * ratio];
    }
    remaining -= lengths[i];
  }
  return points.at(-1);
}
