import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header/Header.jsx';
import History from './pages/History/History.jsx';
import Reception from './pages/Reception/Reception.jsx';
import ReportSummary from './components/ReportSummary.jsx';
import { useCenterReports } from './hooks/useCenterReports.js';
import { responseStatusLabels } from './utils/responseStatus.js';

const shortId = (report) => `119-${String(report.reportId).padStart(3, '0')}`;

export default function App() {
  const { reports, selectedId, setSelectedId, now, resetReports, advanceReport, error, connected, loading, busy } = useCenterReports();
  const [tab, setTab] = useState('intake');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  // Keep temporary action feedback inside the existing heading row, without changing page height.
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const selected = reports.find((report) => report.reportId === selectedId) || reports[0];
  const pending = reports.filter((report) => report.responseStatus !== 'CLOSED');
  const recentPending = [...pending].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)).slice(0, 5);
  const waiting = reports.filter((report) => report.responseStatus === 'PENDING').length;
  const active = reports.filter((report) => ['DISPATCHED', 'ARRIVED'].includes(report.responseStatus)).length;
  const closed = reports.filter((report) => report.responseStatus === 'CLOSED').length;
  const filtered = useMemo(() => reports.filter((report) =>
    (!filter || report.responseStatus === filter) &&
    `${report.reportId} ${report.facility} ${report.detailLocation} ${report.cameraId}`.toLowerCase().includes(search.toLowerCase())
  ), [reports, filter, search]);
  const recentHistory = [...filtered].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)).slice(0, 5);

  function choose(reportId) {
    setSelectedId(reportId);
    setTab('intake');
    setNotice('');
  }

  async function advance(status) {
    if (await advanceReport(status)) setNotice(`${shortId(selected)} · ${responseStatusLabels[status]}`);
  }

  function reset() {
    resetReports();
    setNotice('신고 목록을 새로 조회합니다.');
  }

  return <div className="app-shell">
    <Header tab={tab} pendingCount={pending.length} onTabChange={setTab} connected={connected} />
    <main>
      {error && <p role="alert">{error}</p>}
      <div className="page-heading">
        <div className="page-heading__title">
          <div className="page-heading__headline">
            <h1>{tab === 'intake' ? '신고 접수 현황' : '신고 이력'}</h1>
            <span role="status" aria-live="polite" aria-atomic="true" className={'action-feedback' + (notice ? ' action-feedback--visible' : '')} title={notice}>
              {notice ? `✓ ${notice}` : ''}
            </span>
          </div>
          {tab === 'history' && <p className="page-subtitle">최근 신고 5건과 단계별 처리 기록을 확인합니다.</p>}
        </div>
        <ReportSummary waiting={waiting} active={active} closed={closed} onReset={reset} />
      </div>
      {tab === 'history'
        ? <History reports={reports} recentHistory={recentHistory} filteredCount={filtered.length} filter={filter} search={search} onFilterChange={setFilter} onSearchChange={setSearch} />
        : selected ? <Reception selected={selected} pendingCount={pending.length} recentPending={recentPending} now={now} onChoose={choose} onAdvance={advance} busy={busy} onHistoryTab={() => setTab('history')} />
        : <p className="empty">{loading ? '신고 목록을 불러오는 중입니다.' : '접수된 신고가 없습니다.'}</p>}
      <footer className="page-footer"><span>119 CENTER / FIRIS PROJECT</span></footer>
    </main>
  </div>;
}
