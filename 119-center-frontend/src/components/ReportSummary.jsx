import './ReportSummary.css';

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Current report counts, calculated from the same data as the reception list. */
export default function ReportSummary({ waiting, active, closed, onReset }) {
  const total = waiting + active + closed;
  const segments = [
    { key: 'waiting', label: '접수 대기', count: waiting },
    { key: 'active', label: '출동·대응 중', count: active },
    { key: 'closed', label: '처리 완료', count: closed },
  ];
  let passed = 0;

  return (
    <div className="report-summary" aria-label="신고 처리 현황">
      <div className="report-summary__chart" role="img" aria-label={`총 ${total}건: 접수 대기 ${waiting}건, 출동·대응 중 ${active}건, 처리 완료 ${closed}건`}>
        <svg viewBox="0 0 48 48" focusable="false" aria-hidden="true">
          <circle cx="24" cy="24" r={RADIUS} className="report-summary__track" />
          <g transform="rotate(-90 24 24)">
            {segments.map(({ key, count }) => {
              const start = passed;
              passed += count;
              return count > 0 && total > 0 ? (
                <circle key={key} cx="24" cy="24" r={RADIUS} className={`report-summary__arc report-summary__arc--${key}`}
                  strokeDasharray={`${count / total * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-start / total * CIRCUMFERENCE} />
              ) : null;
            })}
          </g>
        </svg>
        <strong aria-hidden="true">{total}</strong>
      </div>
      <div className="report-summary__stats">
        {segments.map(({ key, label, count }) => (
          <div className="report-summary__stat" key={key}>
            <span className="report-summary__label"><i className={`report-summary__dot report-summary__dot--${key}`} aria-hidden="true" />{label}</span>
            <strong>{count}<small>건</small></strong>
          </div>
        ))}
      </div>
      <button type="button" className="report-summary__reset" onClick={onReset} title="시연용 신고 기록을 초기 상태로 되돌립니다">초기화</button>
    </div>
  );
}
