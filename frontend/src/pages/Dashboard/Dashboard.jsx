import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, apiError, fetchMedia } from '../../api/client.js';
import './Dashboard.css';
import { Modal } from '../../components/Console/Console.jsx';
const cameraSlots = [
  ['CAM001', '공장 A구역'], ['CAM002', '공장 B구역'],
  ['CAM005', '공장 C구역'], ['CAM006', '공장 D구역'], ['CAM007', '공장 E구역'],
  ['CAM003', '창고 A구역'], ['CAM004', '창고 B구역'],
  ['CAM008', '창고 C구역'], ['CAM009', '창고 D구역'],
];
const cameraSelectionKey = 'firis-dashboard-cameras';

const statisticIconPaths = {
  '이벤트 검수 현황': 'M12 3 20 6v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z M12 8v5 M12 16h.01',
  'CCTV FEED INTEGRITY': 'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z M16 10l6-3v10l-6-3',
};

function LiveFrame({ camera, onExpand }) {
  const [frame, setFrame] = useState(null);
  const [state, setState] = useState('AI 화면 연결 대기');

  useEffect(() => {
    let active = true;
    if (camera.unregistered) { setState('카메라 연결 준비 중'); return; }
    let currentUrl;
    let controller;
    let polling = false;
    async function update() {
      if (polling) return;
      polling = true;
      controller = new AbortController();
      let nextUrl;
      try {
        nextUrl = await fetchMedia(`/api/cameras/${encodeURIComponent(camera.cameraId)}/frame`, controller.signal);
        if (!active) { URL.revokeObjectURL(nextUrl); return; }
        const image = new Image();
        image.src = nextUrl;
        await image.decode();
        if (!active) { URL.revokeObjectURL(nextUrl); return; }
        const previousUrl = currentUrl;
        currentUrl = nextUrl;
        setFrame(nextUrl);
        if (previousUrl) window.setTimeout(() => URL.revokeObjectURL(previousUrl), 100);
        setState('AI 분석 중');
      } catch (error) {
        if (!active) return;
        if (nextUrl && nextUrl !== currentUrl) URL.revokeObjectURL(nextUrl);
        setState(error.response?.status === 404 ? 'AI 영상 대기' : 'AI 분석 화면 연결 대기');
      } finally { polling = false; }
    }
    update();
    const timer = window.setInterval(update, 125);
    return () => { active = false; window.clearInterval(timer); controller?.abort(); if (currentUrl) URL.revokeObjectURL(currentUrl); };
  }, [camera.cameraId, camera.unregistered]);

  return <article className={`camera-feed${onExpand ? ' camera-feed--clickable' : ''}`} role={onExpand ? 'button' : undefined} tabIndex={onExpand ? 0 : undefined} aria-label={onExpand ? `${camera.location} ${camera.cameraName} 확대 보기` : undefined} onClick={onExpand} onKeyDown={onExpand ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onExpand(); } } : undefined}>
    <div className="camera-feed__heading"><div className="camera-feed__name"><span className="camera-feed__status-dot" aria-hidden="true" /><h3>{camera.cameraName}</h3><span className="camera-feed__location">[{camera.location || '위치 미등록'}]</span></div><span className="camera-feed__format">{camera.status}</span></div>
    <div className="camera-feed__viewport" aria-label={`${camera.cameraName} AI 분석 화면`}>
      {frame && <img className="camera-feed__image" src={frame} alt={`${camera.cameraName} 불꽃·연기 탐지 화면`} />}
      <div className="camera-feed__viewport-status"><span>{state}</span><span>{camera.cameraId}</span></div>
      <span className="camera-feed__timestamp">LIVE</span>
    </div>
    <div className="camera-feed__footer"><span>{camera.cameraId} / {camera.status}</span><span>FIRE · SMOKE 탐지</span></div>
  </article>;
}

export default function Dashboard() {
  const [cameras, setCameras] = useState([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [expandedCameraId, setExpandedCameraId] = useState(null);
  const [selectedCameraIds, setSelectedCameraIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(cameraSelectionKey));
      if (Array.isArray(saved)) return saved.filter((id) => cameraSlots.some(([cameraId]) => cameraId === id));
    } catch { /* Use the default four views if storage is unavailable. */ }
    return ['CAM001', 'CAM002', 'CAM003', 'CAM004'];
  });
  useEffect(() => {
    try { localStorage.setItem(cameraSelectionKey, JSON.stringify(selectedCameraIds)); } catch { /* Selection remains usable for this session. */ }
  }, [selectedCameraIds]);
  const availableCameras = cameraSlots.map(([cameraId, location]) => ({
    ...(cameras.find((camera) => camera.cameraId === cameraId) || { cameraId, cameraName: `CCTV ${cameraId.slice(-2)}`, status: '연결 준비', unregistered: true }),
    location,
  }));
  const visibleCameras = availableCameras.filter((camera) => selectedCameraIds.includes(camera.cameraId));
  const expandedCamera = availableCameras.find((camera) => camera.cameraId === expandedCameraId);
  const columns = visibleCameras.length <= 1 ? 1 : visibleCameras.length <= 4 ? 2 : 3;
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({ today: 0, unreviewed: 0, fire: 0, falsePositive: 0 });
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const [cameraResult, recent, daily, pending, real, falsePositives] = await Promise.all([
          apiClient.get('/api/cameras'), apiClient.get('/api/events', { params: { page: 0, size: 5 } }),
          apiClient.get('/api/events', { params: { page: 0, size: 1, from: today, to: today } }),
          apiClient.get('/api/events', { params: { page: 0, size: 1, reviewStatus: 'UNREVIEWED' } }),
          apiClient.get('/api/events', { params: { page: 0, size: 1, reviewStatus: 'TRUE_FIRE' } }),
          apiClient.get('/api/events', { params: { page: 0, size: 1, reviewStatus: 'FALSE_POSITIVE' } }),
        ]);
        if (!active) return;
        setCameras(cameraResult.data.filter((camera) => /^CAM00[1-9]$/.test(camera.cameraId)).sort((a, b) => a.cameraId.localeCompare(b.cameraId)));
        setEvents(recent.data.content);
        setCounts({ today: daily.data.totalElements, unreviewed: pending.data.totalElements, fire: real.data.totalElements, falsePositive: falsePositives.data.totalElements });
        setError('');
      } catch (cause) { if (active) setError(apiError(cause)); }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const latestEvent = events[0];
  const eventTypes = { FIRE: '화재', SMOKE: '연기', FIRE_SMOKE: '화재·연기' };
  const reviewStates = { UNREVIEWED: '미처리', TRUE_FIRE: '화재 확정', FALSE_POSITIVE: '오탐' };
  const online = cameras.filter((camera) => camera.status === 'ONLINE').length;
  const totalEvents = counts.unreviewed + counts.fire + counts.falsePositive;
  const reviewRate = totalEvents ? Math.round((counts.fire + counts.falsePositive) / totalEvents * 100) : 0;
  const statistics = [
    { label: '이벤트 검수 현황', tone: 'amber', metrics: [
      { label: '검수 대기', value: counts.unreviewed, tone: 'amber' },
      { label: '화재 확정', value: counts.fire, tone: 'red' },
      { label: '오탐 판정', value: counts.falsePositive, tone: 'amber' },
    ] },
    { label: 'CCTV FEED INTEGRITY', value: `${visibleCameras.length} / 9`, unit: '', detail: `표시 중 / 전체 화면 · ONLINE ${online}대`, tone: 'neutral' },
  ];
  return (
    <main className="dashboard">
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div className="dashboard-hero__mark" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M12 2.5 20 6v5.5c0 4.5-3.3 8-8 10-4-2-8-5-8-10V6l8-3.5Z" /><path d="M12.5 7.5c.5 3-3.5 3.5-3.5 6a3 3 0 0 0 6 0c0-1.2-.5-2.3-1.5-3-.1 1-.6 1.5-1 1.7.5-1.7.5-3.2 0-4.7Z" /></svg></div>
        <div className="dashboard-hero__copy"><div className="dashboard-hero__meta"><span className="dashboard-hero__status">SYSTEM LIVE</span><span>AI · Backend 관제 연동</span></div><h1 id="dashboard-title">종합 화재 관제 모니터링 콘솔</h1><p>CCTV 영상 기반 화재·연기 탐지 · 통합 상황 모니터링</p></div>
        <div className="dashboard-hero__clock" aria-label="현재 한국 시간"><span>LOCAL TIME</span><strong>{now.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })}</strong></div>
      </section>
      {error && <p role="alert" className="dashboard-error">{error}</p>}
      <div className="dashboard-layout">
        <section className="dashboard-cctv" aria-labelledby="cctv-title"><div className="dashboard-cctv__heading"><div><p className="dashboard__eyebrow">LIVE MONITORING / ZONE OVERVIEW</p><h2 id="cctv-title">CCTV 실시간 모니터링</h2></div><div className="dashboard-cctv__legend" aria-label="감지 표시 범례"><span><i className="dashboard-cctv__legend-fire" />불꽃 감지</span><span><i className="dashboard-cctv__legend-smoke" />연기 감지</span></div></div><div className="dashboard__feeds" style={{ '--feed-columns': columns, '--feed-rows': Math.max(1, Math.ceil(visibleCameras.length / columns)) }} aria-label={`CCTV ${visibleCameras.length}개 화면`}>{visibleCameras.map((camera) => <LiveFrame key={camera.cameraId} camera={camera} onExpand={() => setExpandedCameraId(camera.cameraId)} />)}{!visibleCameras.length && <p className="dashboard-feeds-empty">표시할 CCTV를 선택해주세요.<button onClick={() => setSelectorOpen(true)}>화면 선택</button></p>}</div></section>
        <aside className="dashboard-statistics" aria-labelledby="statistics-title"><div className="dashboard-statistics__heading"><div><p className="dashboard__eyebrow">SYSTEM OVERVIEW</p><h2 id="statistics-title">관제 현황</h2></div></div><div className="dashboard-statistics__cards">{statistics.map((statistic) => <article className={`stat-card stat-card--${statistic.tone}${statistic.metrics ? ' stat-card--review' : ''}`} key={statistic.label}><div className="stat-card__heading"><h3>{statistic.label}</h3><svg className="stat-card__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={statisticIconPaths[statistic.label]} /></svg></div>{statistic.metrics ? <><div className="stat-card__review-content"><div className="stat-card__gauge" aria-label={totalEvents ? `검수 완료율 ${reviewRate}%` : '검수 데이터 없음'} style={{ '--review-progress': `${reviewRate * 3.6}deg` }}><div><span>검수 완료율</span><strong>{totalEvents ? `${reviewRate}%` : '—'}</strong><small>{totalEvents ? '전체 기간 기준' : '데이터 없음'}</small></div></div><div className="stat-card__metrics">{statistic.metrics.map((metric) => <div className={`stat-card__metric stat-card__metric--${metric.tone}`} key={metric.label}><div><span>{metric.label}</span><strong>{metric.value}건</strong></div><i aria-hidden="true" style={{ '--metric-fill': `${totalEvents ? metric.value / totalEvents * 100 : 0}%` }} /></div>)}</div></div><p className="stat-card__detail">전체 이벤트 {totalEvents}건 · 전체 기간 기준</p><Link className="stat-card__today" to="/history">오늘 감지 <strong>{counts.today}건</strong><span>이벤트 이력 보기 ↗</span></Link></> : <><p className="stat-card__value"><strong>{statistic.eventId ? <Link to={`/history?eventId=${statistic.eventId}`}>{statistic.value}</Link> : statistic.value}</strong>{statistic.unit && <small>{statistic.unit}</small>}</p><p className="stat-card__detail">{statistic.detail}</p><button className="camera-select-button" onClick={() => setSelectorOpen(true)}>CCTV 화면 선택</button>{statistic.footnote && <p className="stat-card__footnote">{statistic.footnote}</p>}</>}</article>)}<article className="stat-card stat-card--latest" aria-labelledby="latest-event-title">
  <div className="stat-card__heading"><h3 id="latest-event-title">최근 감지 이벤트</h3></div>
  {latestEvent ? <>
    <div className="latest-event__summary"><strong>{eventTypes[latestEvent.eventType] || latestEvent.eventType}</strong><span className={`latest-event__status latest-event__status--${latestEvent.reviewStatus}`}>{latestEvent.responseCompletedAt ? '대응 완료' : reviewStates[latestEvent.reviewStatus] || '상태 미확인'}</span></div>
    <dl className="latest-event__details">
      <div><dt>감지 위치</dt><dd>{latestEvent.location || '위치 미등록'}</dd></div>
      <div><dt>CCTV</dt><dd>{latestEvent.cameraName || latestEvent.cameraId}</dd></div>
      <div><dt>감지 시각</dt><dd><time dateTime={latestEvent.detectedAt}>{latestEvent.detectedAt?.replace('T', ' ') || '시각 미기록'}</time></dd></div>
    </dl>
    <Link className="stat-card__today" to={`/history?eventId=${latestEvent.eventId}`}>EVT-{latestEvent.eventId}<span>상세 리포트 보기 ↗</span></Link>
  </> : <p className="stat-card__detail">{error ? '이벤트 정보를 불러오지 못했습니다.' : '감지 이력 없음'}</p>}
</article></div></aside>
      </div>
      {selectorOpen && <Modal title="CCTV 화면 선택" subtitle={`표시 중 ${visibleCameras.length} / 9대`} onClose={() => setSelectorOpen(false)}>
        <div className="console-modal__body">
          <p>대시보드에 표시할 화면을 선택하세요. 화면을 꺼도 영상 분석은 계속됩니다.</p>
          <div className="camera-selector-actions"><button onClick={() => setSelectedCameraIds(cameraSlots.map(([id]) => id))}>전체 켜기</button><button onClick={() => setSelectedCameraIds([])}>전체 끄기</button></div>
          <div className="camera-selector-grid">{availableCameras.map((camera) => <label key={camera.cameraId} className="camera-selector-item"><div><strong>{camera.location}</strong><small>{camera.cameraId}</small></div><input type="checkbox" role="switch" aria-label={`${camera.location} 화면 표시`} checked={selectedCameraIds.includes(camera.cameraId)} onChange={(event) => setSelectedCameraIds((ids) => event.target.checked ? [...ids, camera.cameraId] : ids.filter((id) => id !== camera.cameraId))} /></label>)}</div>
        </div><footer className="console-modal__footer"><button onClick={() => setSelectorOpen(false)}>완료</button></footer>
      </Modal>}

      {expandedCamera && <Modal wide title={`${expandedCamera.location} · CCTV 확대 보기`} subtitle={`${expandedCamera.cameraName} / ${expandedCamera.cameraId}`} onClose={() => setExpandedCameraId(null)}>
        <div className="camera-expanded-view"><LiveFrame key={expandedCamera.cameraId} camera={expandedCamera} /></div>
        <footer className="console-modal__footer"><button onClick={() => setExpandedCameraId(null)}>닫기</button></footer>
      </Modal>}
    </main>
  );
}
