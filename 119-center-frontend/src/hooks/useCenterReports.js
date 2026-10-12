import { useCallback, useEffect, useRef, useState } from 'react';
import { request, normalizeReport, connectCenter } from '../api/client.js';

export function useCenterReports() {
  const [reports, setReports] = useState([]), [selectedId, setSelectedId] = useState(null);
  const [now, setNow] = useState(Date.now()), [error, setError] = useState('');
  const [connected, setConnected] = useState(false), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const alive = useRef(false), fetching = useRef(false), dirty = useRef(false), actionLock = useRef(false);
  const refresh = useCallback(async () => {
    if (fetching.current) { dirty.current = true; return; }
    fetching.current = true;
    try {
      do {
        dirty.current = false;
        const rows = [];
        let page = 0, pages = 1;
        do {
          const data = await request(`/api/mock-119-center/reports?page=${page}&size=100`);
          rows.push(...data.content.map(normalizeReport)); pages = data.totalPages; page++;
        } while (alive.current && page < pages);
        if (alive.current) {
          setReports(rows); setError('');
          setSelectedId(id => rows.some(r => r.reportId === id) ? id : rows[0]?.reportId ?? null);
        }
      } while (alive.current && dirty.current);
    } catch (e) { if (alive.current) setError(e.message); }
    finally { fetching.current = false; if (alive.current) setLoading(false); }
  }, []);
  useEffect(() => {
    alive.current = true;
    refresh();
    const disconnect = connectCenter(refresh, value => { if (alive.current) setConnected(value); });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Covers missed messages and media becoming available without a status transition.
    const recovery = setInterval(refresh, 30000);
    return () => { alive.current = false; disconnect(); clearInterval(tick); clearInterval(recovery); };
  }, [refresh]);
  async function advanceReport(responseStatus) {
    const r = reports.find(row => row.reportId === selectedId);
    if (!r || actionLock.current) return false;
    actionLock.current = true; setBusy(true); setError('');
    try {
      await request(`/api/mock-119-center/reports/${r.reportId}/response-status`, {
        method: 'PATCH', body: JSON.stringify({ expectedStatus: r.responseStatus, responseStatus }),
      });
      await refresh(); return true;
    } catch (e) { await refresh(); setError(e.message); return false; }
    finally { actionLock.current = false; setBusy(false); }
  }
  return { reports, selectedId, setSelectedId, now, error, connected, loading, busy,
    resetReports: refresh, advanceReport };
}
