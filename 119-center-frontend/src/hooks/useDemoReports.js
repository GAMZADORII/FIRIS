import { useEffect, useState } from 'react';
import { STORAGE_KEY, makeDemoReports, responseStatusLabels, transitionReport, updateDueArrivals } from '../utils/responseSimulation.js';

function loadReports() {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(cached) && cached.length && cached.every((report) =>
      report.reportId && responseStatusLabels[report.responseStatus] &&
      report.routePoints?.length > 1 && Array.isArray(report.history)
    )) return updateDueArrivals(cached);
  } catch { /* The mock also works with storage disabled. */ }
  return makeDemoReports();
}

export function useDemoReports() {
  const [reports, setReports] = useState(loadReports);
  const [selectedId, setSelectedId] = useState(() => loadReports()[0].reportId);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      setReports((rows) => updateDueArrivals(rows, tick));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reports)); }
    catch { /* The mock also works with storage disabled. */ }
  }, [reports]);

  function resetReports() {
    const fresh = makeDemoReports();
    setReports(fresh);
    setSelectedId(fresh[0].reportId);
    setNow(Date.now());
  }

  function advanceReport(status) {
    const tick = Date.now();
    setNow(tick);
    setReports((rows) => rows.map((report) =>
      report.reportId === selectedId ? transitionReport(report, status, tick) : report
    ));
  }

  return { reports, selectedId, setSelectedId, now, resetReports, advanceReport };
}
