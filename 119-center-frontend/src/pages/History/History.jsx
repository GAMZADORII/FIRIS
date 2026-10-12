import { useState } from 'react';
import ReportDetailModal from '../../components/ReportDetailModal/ReportDetailModal.jsx';
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx';
import { responseStatusLabels } from '../../utils/responseStatus.js';

const shortId = (report) => `119-${String(report.reportId).padStart(3, '0')}`;
const clock = (value) => value?.slice(11, 19) || '—';

export default function History({ reports, recentHistory, filteredCount, filter, search, onFilterChange, onSearchChange }) {
  const [detailId, setDetailId] = useState(null);
  const detailReport = reports.find((report) => report.reportId === detailId) || null;
  const labels = responseStatusLabels;
  const Badge = StatusBadge;
  return (
    <section className="panel archive"><div className="panel-title"><h2>최근 신고 기록 <span>{recentHistory.length}건</span></h2><span className="subtle">최신 5건 표시</span></div><div className="list-toolbar"><input aria-label="신고 이력 검색" placeholder="신고 번호, 시설, CCTV 검색" value={search} onChange={e=>onSearchChange(e.target.value)}/><select aria-label="상태 필터" value={filter} onChange={e=>onFilterChange(e.target.value)}><option value="">전체 상태</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div><div className="table-scroll"><table><thead><tr><th>신고 번호</th><th>시설 / 발생 위치</th><th>신고 시각</th><th>신고자</th><th>처리 상태</th><th>상세</th></tr></thead><tbody>{recentHistory.map(r=><tr key={r.reportId}><td>{shortId(r)}</td><td><strong>{r.facility}</strong><small>{r.detailLocation} · {r.cameraId}</small></td><td>{r.reportedAt?.slice(5, 10).replace('-', '.')} {clock(r.reportedAt)}</td><td>{r.reporterName}</td><td><Badge status={r.responseStatus}/></td><td><button className="small-button" onClick={()=>setDetailId(r.reportId)}>상세 보기 ↗</button></td></tr>)}{!filteredCount&&<tr><td colSpan="6" className="empty">검색 결과가 없습니다.</td></tr>}</tbody></table></div>
      <ReportDetailModal report={detailReport} onClose={() => setDetailId(null)} />
    </section>
  );
}
