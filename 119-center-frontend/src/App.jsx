import { useMemo, useState } from 'react';
import Header from './components/Header/Header.jsx';
import History from './pages/History/History.jsx';
import Reception from './pages/Reception/Reception.jsx';
import { useDemoReports } from './hooks/useDemoReports.js';
import { responseStatusLabels } from './utils/responseSimulation.js';

const shortId = (report) => `119-${String(report.reportId).padStart(3, '0')}`;

export default function App() {
  const { reports, selectedId, setSelectedId, now, resetReports, advanceReport } = useDemoReports();
  const [tab, setTab] = useState('intake');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  const selected = reports.find((report) => report.reportId === selectedId) || reports[0];
  const pending = reports.filter((report) => report.responseStatus !== 'CLOSED');
  const recentPending = [...pending].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)).slice(0, 5);
  const waiting = reports.filter((report) => report.responseStatus === 'PENDING').length;
  const active = reports.filter((report) => ['DISPATCHED', 'ARRIVED'].includes(report.responseStatus)).length;
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

  function advance(status) {
    advanceReport(status);
    setNotice(`${shortId(selected)} · ${responseStatusLabels[status]} 처리되었습니다.`);
  }

  function reset() {
    resetReports();
    setNotice('신고 목록이 초기화되었습니다.');
  }

  return <div className="app-shell">
    <Header tab={tab} pendingCount={pending.length} onTabChange={setTab} />
    <main>
      <div className="page-heading">
        <div><h1>{tab === 'intake' ? '신고 접수 현황' : '신고 이력'}</h1><p className="page-subtitle">{tab === 'intake' ? '신고된 화재의 영상과 발생 위치를 확인하고 출동을 처리합니다.' : '최근 신고 5건과 단계별 처리 기록을 확인합니다.'}</p></div>
        <div className="overview"><span>신규 신고 <b>{waiting}</b></span><span>진행 중 <b>{active}</b></span><span>종료 <b>{reports.length - pending.length}</b></span><button className="outline-button" onClick={reset}>↻ 시연 초기화</button></div>
      </div>
      {notice && <div role="status" className="toast">✓ {notice}<button onClick={() => setNotice('')} aria-label="알림 닫기">×</button></div>}
      {tab === 'history'
        ? <History reports={reports} recentHistory={recentHistory} filteredCount={filtered.length} filter={filter} search={search} onFilterChange={setFilter} onSearchChange={setSearch} />
        : <Reception selected={selected} recentPending={recentPending} now={now} onChoose={choose} onAdvance={advance} onHistoryTab={() => setTab('history')} />}
      <footer className="page-footer"><span>119 CENTER / FIRIS PROJECT</span></footer>
    </main>
  </div>;
}
