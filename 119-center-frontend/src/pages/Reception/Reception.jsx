import { formatDateTime, formatClock as clock } from '../../utils/dateTime.js';
import { useEffect, useState } from 'react';
import FacilityPlan from '../../components/FacilityPlan/FacilityPlan.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import EventVideo from '../../components/EventVideo.jsx';
import ResponseMap from '../../components/ResponseMap/ResponseMap.jsx';
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx';
import { responseSteps } from '../../utils/responseStatus.js';
import { formatPhone } from '../../utils/phone.js';

const shortId = (report) => `119-${String(report.reportId).padStart(3, '0')}`;

export default function Reception({ selected, pendingCount, recentPending, page, pageCount, onPageChange, now, onChoose, onAdvance, onHistoryTab, busy }) {
  const [videoExpanded, setVideoExpanded] = useState(false);
  useEffect(() => setVideoExpanded(false), [selected?.reportId]);
  const Badge = StatusBadge;
  const steps = responseSteps;
  return (
    <div className="workspace">
      <aside className="panel queue-panel"><div className="panel-title queue-panel__heading"><h2>접수된 신고</h2><span className="queue-panel__count">{pendingCount}<small>건</small></span></div><div className="queue-list">{recentPending.map(r=><button key={r.reportId} className={'queue-item '+(selected?.reportId===r.reportId?'selected':'')} aria-label={shortId(r)+' 신고 선택'} aria-pressed={selected?.reportId===r.reportId} onClick={()=>onChoose(r.reportId)}><div className="queue-meta"><strong>{shortId(r)}</strong><time>{clock(r.reportedAt)}</time></div><h3>{r.facility}</h3><p>{r.detailLocation}</p><div className="queue-bottom"><Badge status={r.responseStatus}/><span>{r.cameraId} →</span></div></button>)}{!recentPending.length&&<p className="empty">현재 접수된 신고가 없습니다.</p>}</div><div className="queue-footer">{pageCount > 1 && <nav className="queue-pagination" aria-label="접수된 신고 페이지"><button className="small-button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>이전</button><span aria-live="polite">{page} / {pageCount}</span><button className="small-button" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>다음</button></nav>}완료된 신고는 신고 이력에서 확인하세요.<button onClick={()=>onHistoryTab()}>전체 신고 이력 보기 →</button></div></aside>
      <section className="panel detail-panel" aria-label="신고 상세">{selected && <><div className="incident-heading"><div><div className="incident-meta"><span>{shortId(selected)} / EVT-{selected.eventId}</span></div><h2>{selected.facility}</h2><p>⌖ {selected.siteAddress} <span>· {selected.detailLocation}</span></p></div><Badge status={selected.responseStatus}/></div>
      <div className="media-grid"><section className="media-card"><div className="card-heading"><h3>탐지 당시 영상</h3><div className="media-heading-actions"><span className="subtle">{selected.cameraId} · AI {selected.confidence}%</span><button type="button" className="small-button" onClick={() => setVideoExpanded(true)}>↗ 확대 보기</button></div></div><EventVideo report={selected}/><div className="media-footer"><span>{selected.detailLocation}</span></div></section><FacilityPlan key={selected.reportId} report={selected}/></div>
      <div className="operations-grid"><section className="information-section"><div className="information-heading"><h3>신고 전달 정보</h3></div><div className="information-row"><div><label>사고유형</label><strong className="danger-text">{selected.accidentType||'화재'}</strong></div><div><label>탐지시간</label><strong>{formatDateTime(selected.detectedAt||selected.reportedAt)}</strong></div><div><label>신고 전송시각</label><strong>{formatDateTime(selected.reportedAt)}</strong></div><div className="address-field"><label>주소</label><strong>{selected.siteAddress}</strong></div><div><label>상세위치</label><strong>{selected.detailLocation || '미등록'}</strong></div><div><label>담당자</label><strong>{selected.reporterName} <span>/ {formatPhone(selected.reporterPhone, '연락처 미등록')}</span></strong></div><div className="note"><label>신고 내용</label><p>{selected.note}</p></div></div></section>
      <div className="response-section"><div className="card-heading"><h3>대응 진행 상황</h3></div><ol className="progress-steps">{steps.map(([key,label],index)=>{const stage=steps.findIndex(([value])=>value===selected.responseStatus);return <li key={key} className={(index<=stage?'done ':'')+(index===stage?'current':'')}><span>{index<stage?'✓':index+1}</span><strong>{label}</strong>{key==='ARRIVED'&&<small>자동 도착</small>}</li>;})}</ol><ResponseMap report={selected} now={now}/></div></div>
      <div className="detail-bottom"><details className="history"><summary>처리 기록 <span>{selected.history.length}개</span></summary><ul>{selected.history.map((h,i)=><li key={h.status+'-'+i}><time>{formatDateTime(h.time)}</time><strong>{h.label}</strong><span>{h.actor}</span></li>)}</ul></details><div className="action-area">{selected.responseStatus==='PENDING'?<><button className="primary-button" disabled={busy} onClick={()=>onAdvance('DISPATCHED')}>출동 지시 →</button></>:selected.responseStatus==='DISPATCHED'?null:selected.responseStatus==='ARRIVED'?<><button className="primary-button" disabled={busy} onClick={()=>onAdvance('CLOSED')}>대응 완료 ✓</button></>:<div className="closed-note">✓ 대응 완료</div>}</div></div>
      </>}</section>
      {selected && <Modal open={videoExpanded} onClose={() => setVideoExpanded(false)} title={`${selected.facility} · 탐지 당시 영상`} className="video-modal">
        <p className="modal-description">{selected.cameraId} · {selected.detailLocation} · {formatDateTime(selected.detectedAt)}</p>
        {videoExpanded && <EventVideo report={selected} />}
      </Modal>}
    </div>
  );
}
