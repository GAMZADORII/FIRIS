export const hasActiveReport = (reports) => reports.some(report =>
  ['PENDING', 'DISPATCHED', 'ARRIVED'].includes(report.responseStatus));

export const keepManualAlerts = (items) => items.filter(item => item.manualOpen);

export const afterCompletedReports = (event, reports) => reports.every(report =>
  !report.closedAt || event.detectedAt > report.closedAt);
