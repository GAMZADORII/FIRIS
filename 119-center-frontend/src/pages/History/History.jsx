import { useState } from 'react';
import ReportDetailModal from '../../components/ReportDetailModal/ReportDetailModal.jsx';
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx';
import { responseStatusLabels } from '../../utils/responseStatus.js';
import './History.css';

const shortId = (report) => `119-${String(report.reportId).padStart(3, '0')}`;
const clock = (value) => value?.slice(11, 19) || '—';

export default function History({ reports, recentHistory, filteredCount, page, pageCount, pageSize, onPageChange, filter, search, onFilterChange, onSearchChange, onAdvance, busy, error }) {
  const [detailId, setDetailId] = useState(null);
  const detailReport = reports.find((report) => report.reportId === detailId) || null;
  const labels = responseStatusLabels;
  const Badge = StatusBadge;
  const firstPage = Math.max(1, Math.min(page - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPage + index);
  return (
    <section className="panel archive"><div className="panel-title"><h2>신고 기록 <span>{filteredCount}건</span></h2><span className="subtle">페이지당 5건 표시</span></div><div className="list-toolbar"><input aria-label="신고 이력 검색" placeholder="신고 번호, 시설, CCTV 검색" value={search} onChange={e=>onSearchChange(e.target.value)}/><select aria-label="상태 필터" value={filter} onChange={e=>onFilterChange(e.target.value)}><option value="">전체 상태</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div><div className="table-scroll"><table><thead><tr><th>신고 번호</th><th>시설 / 발생 위치</th><th>신고 시각</th><th>신고자</th><th>처리 상태</th><th>상세</th></tr></thead><tbody>{recentHistory.map(r=><tr key={r.reportId}><td>{shortId(r)}</td><td><strong>{r.facility}</strong><small>{r.detailLocation} · {r.cameraId}</small></td><td>{r.reportedAt?.slice(5, 10).replace('-', '.')} {clock(r.reportedAt)}</td><td>{r.reporterName}</td><td><Badge status={r.responseStatus}/></td><td><button className="small-button" onClick={()=>setDetailId(r.reportId)}>상세 보기 ↗</button></td></tr>)}{!filteredCount&&<tr><td colSpan="6" className="empty">검색 결과가 없습니다.</td></tr>}</tbody></table></div>
      <div className="history-pagination">
        <span className="subtle" aria-live="polite">총 {filteredCount}건 · {filteredCount ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredCount)}건 표시</span>
        <nav aria-label="신고 이력 페이지">
          <button className="small-button" disabled={page === 1} onClick={() => onPageChange(1)}>처음</button>
          <button className="small-button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>이전</button>
          {pageNumbers.map(number => <button key={number} className="small-button" aria-label={`${number}페이지`} aria-current={page === number ? 'page' : undefined} disabled={!filteredCount} onClick={() => onPageChange(number)}>{number}</button>)}
          <button className="small-button" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>다음</button>
          <button className="small-button" disabled={page === pageCount} onClick={() => onPageChange(pageCount)}>마지막</button>
        </nav>
      </div>
      <ReportDetailModal report={detailReport} onClose={() => setDetailId(null)} onAdvance={onAdvance} busy={busy} error={error} />
    </section>
  );
}
