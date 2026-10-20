export function paginatePendingReports(reports, requestedPage = 1, pageSize = 5) {
  const pending = reports.filter(report => report.responseStatus !== 'CLOSED')
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt) || b.reportId - a.reportId);
  const pageCount = Math.max(1, Math.ceil(pending.length / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  return {
    reports: pending.slice((page - 1) * pageSize, page * pageSize),
    total: pending.length, page, pageCount,
  };
}