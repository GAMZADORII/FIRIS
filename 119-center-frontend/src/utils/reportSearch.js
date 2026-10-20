import { cameraDisplayName } from './cameraChannels.js';

export function matchesReportSearch(report, query) {
  const normalize = value => value.toLowerCase().replace(/\s+/g, '');
  const fields = [report.reportId, `119-${String(report.reportId).padStart(3, '0')}`,
    report.facility, report.detailLocation, report.cameraId, cameraDisplayName(report.cameraId)];
  return normalize(fields.join(' ')).includes(normalize(query));
}