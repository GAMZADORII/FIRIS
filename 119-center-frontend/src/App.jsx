import { matchesReportSearch } from './utils/reportSearch.js';
import { paginatePendingReports } from './utils/intakePagination.js';
import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header/Header.jsx';
import History from './pages/History/History.jsx';
import Reception from './pages/Reception/Reception.jsx';
import ReportSummary from './components/ReportSummary.jsx';
import { useCenterReports } from './hooks/useCenterReports.js';
import { responseStatusLabels } from './utils/responseStatus.js';

const shortId = (report) => `119-${String(report.reportId).padStart(3, '0')}`;

export default function App() {
  const { reports, selectedId, setSelectedId, now, advanceReport, error, busy } = useCenterReports();
  const [tab, setTab] = useState('intake');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [intakePage, setIntakePage] = useState(1);
  const [notice, setNotice] = useState('');

  // Keep temporary action feedback inside the existing heading row, without changing page height.
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const intake = paginatePendingReports(reports, intakePage);
  const recentPending = intake.reports;
  const selected = recentPending.find(report => report.reportId === selectedId) || recentPending[0];
  useEffect(() => setIntakePage(page => Math.min(page, intake.pageCount)), [intake.pageCount]);
  const waiting = reports.filter((report) => report.responseStatus === 'PENDING').length;
  const active = reports.filter((report) => ['DISPATCHED', 'ARRIVED'].includes(report.responseStatus)).length;
  const closed = reports.filter((report) => report.responseStatus === 'CLOSED').length;
  const filtered = useMemo(() => reports.filter((report) =>
    (!filter || report.responseStatus === filter) &&
    matchesReportSearch(report, search)
  ), [reports, filter, search]);
  const historyPageSize = 8;
  const historyPageCount = Math.max(1, Math.ceil(filtered.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const recentHistory = [...filtered].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt) || b.reportId - a.reportId)
    .slice((currentHistoryPage - 1) * historyPageSize, currentHistoryPage * historyPageSize);
  useEffect(() => setHistoryPage(page => Math.min(page, historyPageCount)), [historyPageCount]);

  function choose(reportId) {
    setSelectedId(reportId);
    setTab('intake');
    setNotice('');
  }

  async function advance(status, reportId = selected?.reportId) {
    const target = reports.find(report => report.reportId === reportId);
    if (!target) return false;
    const succeeded = await advanceReport(status, reportId);
    if (succeeded) setNotice(`${shortId(target)} · ${responseStatusLabels[status]}`);
    return succeeded;
  }

  return <div className="app-shell">
    <Header tab={tab} pendingCount={intake.total} onTabChange={setTab} />
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
          {tab === 'history' && <p className="page-subtitle">전체 신고 이력과 단계별 처리 기록을 확인합니다.</p>}
        </div>
        <ReportSummary waiting={waiting} active={active} closed={closed} />
      </div>
      {tab === 'history'
        ? <History reports={reports} recentHistory={recentHistory} filteredCount={filtered.length} page={currentHistoryPage} pageCount={historyPageCount} pageSize={historyPageSize} onPageChange={setHistoryPage} filter={filter} search={search} onFilterChange={value => { setFilter(value); setHistoryPage(1); }} onSearchChange={value => { setSearch(value); setHistoryPage(1); }} onAdvance={advance} busy={busy} error={error} />
        : <Reception selected={selected} pendingCount={intake.total} recentPending={recentPending} page={intake.page} pageCount={intake.pageCount} onPageChange={setIntakePage} now={now} onChoose={choose} onAdvance={advance} busy={busy} onHistoryTab={() => setTab('history')} />}
      <footer className="page-footer"><span>119 CENTER / FIRIS PROJECT</span></footer>
    </main>
  </div>;
}
