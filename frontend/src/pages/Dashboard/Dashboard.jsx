import './Dashboard.css';
import cameraImage01 from '../../assets/images/cctv/cctv-01.png';
import cameraImage02 from '../../assets/images/cctv/cctv-02.png';
import cameraImage03 from '../../assets/images/cctv/cctv-03.png';
import cameraImage04 from '../../assets/images/cctv/cctv-04.png';

const cameras = [
  {
    id: 'camera-1',
    label: 'CCTV-01',
    location: '중앙 물류창고 A구역',
    format: 'FPS: 30 / 4K UHD',
    image: cameraImage01,
    detection: { type: 'fire', label: '불꽃 감지', position: { top: '22%', left: '72%', width: '25%', height: '54%' } },
  },
  {
    id: 'camera-2',
    label: 'CCTV-02',
    location: '제2 공정 도장라인',
    format: 'FPS: 30 / 1080p',
    image: cameraImage02,
    detection: { type: 'smoke', label: '연기 감지', position: { top: '22%', left: '58%', width: '30%', height: '55%' } },
  },
  {
    id: 'camera-3',
    label: 'CCTV-03',
    location: '원자재 저장고 B동',
    format: 'FPS: 30 / 1080p',
    image: cameraImage03,
  },
  {
    id: 'camera-4',
    label: 'CCTV-04',
    location: '전기 수변전실 전면',
    format: 'FPS: 30 / 1080p',
    image: cameraImage04,
  },
];

const statistics = [
  {
    label: 'RISK INDEX TELEMETRY',
    value: '78',
    unit: '%',
    detail: '종합 위험 지수',
    tone: 'amber',
    metrics: [
      { label: '알람 감지', value: '84%', fill: 84, tone: 'red' },
      { label: '연기 밀도', value: '62%', fill: 62, tone: 'amber' },
      { label: '공기질 지수', value: '주의 (MOD)', fill: 42, tone: 'amber' },
    ],
  },
  { label: 'CCTV FEED INTEGRITY', value: '18 / 18', unit: '', detail: '전 채널 패킷 스트림 정상 수신', tone: 'neutral' },
  { label: 'DAILY DETECTION', value: '4', unit: '건', detail: '화재 1 · 연기 2 · 오탐 1', tone: 'red' },
  { label: '119 DIRECT TRUNK', value: '연결 양호', unit: '', detail: '관할 종합방재센터 광케이블 직통', footnote: 'LATENCY 0.4s (STABLE)', tone: 'amber' },
  { label: 'SECURITY DEFCON', value: '2단계 경계', unit: '', detail: '자율대응군 현장 출동 대기 병행', tone: 'amber' },
];

const statisticIconPaths = {
  'RISK INDEX TELEMETRY': 'M12 3 20 6v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z M12 8v5 M12 16h.01',
  'CCTV FEED INTEGRITY': 'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z M16 10l6-3v10l-6-3',
  'DAILY DETECTION': 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4 M12 2V1',
  '119 DIRECT TRUNK': 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z',
  'SECURITY DEFCON': 'M12 3 20 6v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z',
};

export default function Dashboard() {
  return (
    <main className="dashboard">
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div className="dashboard-hero__mark" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            <path d="M12 2.5 20 6v5.5c0 4.5-3.3 8-8 10-4.7-2-8-5.5-8-10V6l8-3.5Z" />
            <path d="M12.5 7.5c.5 3-3.5 3.5-3.5 6a3 3 0 0 0 6 0c0-1.2-.5-2.3-1.5-3-.1 1-.6 1.5-1 1.7.5-1.7.5-3.2 0-4.7Z" />
          </svg>
        </div>
        <div className="dashboard-hero__copy">
          <div className="dashboard-hero__meta">
            <span className="dashboard-hero__status">SYSTEM STANDBY</span>
            <span>관제 데이터 연결 대기</span>
          </div>
          <h1 id="dashboard-title">종합 화재 관제 모니터링 콘솔</h1>
          <p>실시간 센서 인텔리전스 · 통합 상황 모니터링</p>
        </div>
        <div className="dashboard-hero__clock" aria-label="시스템 시간 연결 대기">
          <span>LOCAL TIME</span>
          <strong>--:--:--</strong>
        </div>
      </section>

      <div className="dashboard-layout">
        <section className="dashboard-cctv" aria-labelledby="cctv-title">
          <div className="dashboard-cctv__heading">
            <div>
              <p className="dashboard__eyebrow">LIVE MONITORING / ZONE OVERVIEW</p>
              <h2 id="cctv-title">CCTV 실시간 모니터링</h2>
            </div>
            <div className="dashboard-cctv__legend" aria-label="감지 표시 범례">
              <span><i className="dashboard-cctv__legend-fire" />불꽃 감지</span>
              <span><i className="dashboard-cctv__legend-smoke" />연기 감지</span>
            </div>
          </div>

          <div className="dashboard__feeds" aria-label="CCTV 4분할 화면">
            {cameras.map((camera) => (
              <article className={`camera-feed${camera.detection ? ` camera-feed--${camera.detection.type}` : ''}`} key={camera.id}>
                <div className="camera-feed__heading">
                  <div className="camera-feed__name">
                    <span className="camera-feed__status-dot" aria-hidden="true" />
                    <h3>{camera.label}</h3>
                    <span className="camera-feed__location">[{camera.location}]</span>
                  </div>
                  <span className="camera-feed__format">{camera.format}</span>
                </div>
                <div className="camera-feed__viewport" role="img" aria-label={`${camera.label} 임시 이미지${camera.detection ? `, ${camera.detection.label} 오버레이 예시` : ''}`}>
                  <img className="camera-feed__image" src={camera.image} alt="" />
                  {camera.detection && (
                    <div
                      className={`detection-overlay detection-overlay--${camera.detection.type}`}
                      style={camera.detection.position}
                    >
                      <span>{camera.detection.label} / DEMO</span>
                    </div>
                  )}
                  <div className="camera-feed__viewport-status">
                    <span>SAMPLE IMAGE</span>
                    <span>{camera.detection ? 'DETECTION OVERLAY DEMO' : 'LIVE STREAM 연결 대기'}</span>
                  </div>
                  <span className="camera-feed__timestamp">--:--:--</span>
                </div>
                <div className="camera-feed__footer">
                  <span>{camera.id.toUpperCase()} / SAMPLE FEED</span>
                  <span>{camera.detection ? `${camera.detection.label} 오버레이 예시` : 'FIRE · SMOKE 감지 대기'}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="dashboard-statistics" aria-labelledby="statistics-title">
          <div className="dashboard-statistics__heading">
            <div>
              <p className="dashboard__eyebrow">SYSTEM OVERVIEW</p>
              <h2 id="statistics-title">관제 현황</h2>
            </div>
            <span>DEMO DATA</span>
          </div>
          <div className="dashboard-statistics__cards">
            {statistics.map((statistic) => (
              <article className={`stat-card stat-card--${statistic.tone}${statistic.metrics ? ' stat-card--risk' : ''}`} key={statistic.label}>
                <div className="stat-card__heading">
                  <h3>{statistic.label}</h3>
                  <svg className="stat-card__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d={statisticIconPaths[statistic.label]} />
                  </svg>
                </div>
                {statistic.metrics ? (
                  <div className="stat-card__risk-content">
                    <div
                      className="stat-card__gauge"
                      aria-label={`위험 지수 ${statistic.value}${statistic.unit}`}
                      style={{ '--risk-progress': `${Number(statistic.value) * 3.6}deg` }}
                    >
                      <div>
                        <span>위험 지수</span>
                        <strong>{statistic.value}{statistic.unit}</strong>
                        <small>종합 위험 지수</small>
                      </div>
                    </div>
                    <div className="stat-card__metrics">
                      {statistic.metrics.map((metric) => (
                        <div className={`stat-card__metric stat-card__metric--${metric.tone}`} key={metric.label}>
                          <div><span>{metric.label}</span><strong>{metric.value}</strong></div>
                          <i aria-hidden="true" style={{ '--metric-fill': `${metric.fill}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="stat-card__value">
                      <strong>{statistic.value}</strong>
                      {statistic.unit && <small>{statistic.unit}</small>}
                    </p>
                    <p className="stat-card__detail">{statistic.detail}</p>
                    {statistic.footnote && <p className="stat-card__footnote">{statistic.footnote}</p>}
                  </>
                )}
              </article>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
