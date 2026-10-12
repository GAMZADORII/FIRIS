import Modal from '../Modal/Modal.jsx';
import MockVideo from '../MockVideo/MockVideo.jsx';
import StatusBadge from '../StatusBadge/StatusBadge.jsx';
import './ReportDetailModal.css';

const eventLabels = { FIRE: '화재', SMOKE: '연기', FIRE_SMOKE: '화재·연기' };
const dateTime = (value) => value?.replace('T', ' ') || '—';
const shortId = (report) => `119-${String(report.reportId).padStart(3, '0')}`;

export default function ReportDetailModal({ report, onClose }) {
  return (
    <Modal
      open={Boolean(report)}
      onClose={onClose}
      title={report ? `${shortId(report)} · 신고 상세` : '신고 상세'}
      className="history-detail-modal"
    >
      {report && <>
        <div className="history-modal-heading">
          <div>
            <h3>{report.facility}</h3>
            <p>{report.siteAddress} · {report.detailLocation}</p>
          </div>
          <StatusBadge status={report.responseStatus} />
        </div>
        <div className="history-modal-content">
          <section className="history-modal-video" aria-label="신고 당시 영상">
            <h4>탐지 당시 영상</h4>
            <MockVideo report={report} />
            <p>{report.cameraId} · {report.detailLocation}</p>
          </section>
          <section className="history-modal-information" aria-label="신고 정보">
            <h4>신고 정보</h4>
            <dl>
              <div><dt>신고 번호</dt><dd>{shortId(report)}</dd></div>
              <div><dt>이벤트 ID</dt><dd>EVT-{report.eventId}</dd></div>
              <div><dt>감지 유형</dt><dd>{eventLabels[report.eventType] || report.eventType}</dd></div>
              <div><dt>CCTV</dt><dd>{report.cameraId}</dd></div>
              <div><dt>탐지 시각</dt><dd>{dateTime(report.detectedAt)}</dd></div>
              <div><dt>신고 시각</dt><dd>{dateTime(report.reportedAt)}</dd></div>
              <div><dt>신고자</dt><dd>{report.reporterName}</dd></div>
              <div><dt>신고자 연락처</dt><dd>{report.reporterPhone}</dd></div>
            </dl>
          </section>
        </div>
        <div className="history-modal-notes">
          <div><h4>신고 내용</h4><p>{report.note || '내용 없음'}</p></div>
          <div><h4>특이사항</h4><p>{report.specialNotes || '없음'}</p></div>
        </div>
        <section className="history-modal-timeline" aria-label="처리 기록">
          <h4>처리 기록</h4>
          <ul>
            {report.history.map((item, index) => <li key={`${item.status}-${index}`}>
              <time>{item.time}</time><strong>{item.label}</strong><span>{item.actor}</span>
            </li>)}
          </ul>
        </section>
      </>}
    </Modal>
  );
}
