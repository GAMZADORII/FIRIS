import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, apiError, fetchMedia } from '../../api/client.js';
import './Dashboard.css';

const statisticIconPaths = {
  'RISK INDEX TELEMETRY': 'M12 3 20 6v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z M12 8v5 M12 16h.01',
  'CCTV FEED INTEGRITY': 'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z M16 10l6-3v10l-6-3',
  'DAILY DETECTION': 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4 M12 2V1',
  '119 DIRECT TRUNK': 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z',
  'SECURITY DEFCON': 'M12 3 20 6v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z',
};

function LiveFrame({ camera }) {
  const [frame, setFrame] = useState(null);
  const [state, setState] = useState('AI 화면 연결 대기');

  useEffect(() => {
    let active = true;
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
  }, [camera.cameraId]);

  return <article className="camera-feed">
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
        setCameras(cameraResult.data.filter((camera) => /^CAM00[1-4]$/.test(camera.cameraId)).sort((a, b) => a.cameraId.localeCompare(b.cameraId)));
        setEvents(recent.data.content);
        setCounts({ today: daily.data.totalElements, unreviewed: pending.data.totalElements, fire: real.data.totalElements, falsePositive: falsePositives.data.totalElements });
        setError('');
      } catch (cause) { if (active) setError(apiError(cause)); }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const online = cameras.filter((camera) => camera.status === 'ONLINE').length;
  const statistics = [
    { label: 'RISK INDEX TELEMETRY', value: '—', unit: '', detail: '종합 위험 지수', tone: 'amber', metrics: [
      { label: '알람 감지', value: '미연동', tone: 'red' },
      { label: '연기 밀도', value: '미연동', tone: 'amber' },
      { label: '공기질 지수', value: '미연동', tone: 'amber' },
    ] },
    { label: 'CCTV FEED INTEGRITY', value: `${online} / ${cameras.length}`, unit: '', detail: 'ONLINE CCTV / 등록 CCTV', tone: 'neutral' },
    { label: 'DAILY DETECTION', value: counts.today, unit: '건', detail: `화재 ${counts.fire} · 오탐 ${counts.falsePositive} · 미검수 ${counts.unreviewed}`, tone: 'red', eventId: events[0]?.eventId },
    { label: '119 DIRECT TRUNK', value: '미연동', unit: '', detail: '관할 종합방재센터 연결 정보 없음', footnote: 'LATENCY DATA UNAVAILABLE', tone: 'amber' },
    { label: 'SECURITY DEFCON', value: '미연동', unit: '', detail: '경계 단계 데이터 없음', tone: 'amber' },
  ];
  return (
    <main className="dashboard">
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div className="dashboard-hero__mark" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M12 2.5 20 6v5.5c0 4.5-3.3 8-8 10-4-2-8-5-8-10V6l8-3.5Z" /><path d="M12.5 7.5c.5 3-3.5 3.5-3.5 6a3 3 0 0 0 6 0c0-1.2-.5-2.3-1.5-3-.1 1-.6 1.5-1 1.7.5-1.7.5-3.2 0-4.7Z" /></svg></div>
        <div className="dashboard-hero__copy"><div className="dashboard-hero__meta"><span className="dashboard-hero__status">SYSTEM LIVE</span><span>AI · Backend 관제 연동</span></div><h1 id="dashboard-title">종합 화재 관제 모니터링 콘솔</h1><p>실시간 센서 인텔리전스 · 통합 상황 모니터링</p></div>
        <div className="dashboard-hero__clock" aria-label="현재 한국 시간"><span>LOCAL TIME</span><strong>{now.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })}</strong></div>
      </section>
      {error && <p role="alert" className="dashboard-error">{error}</p>}
      <div className="dashboard-layout">
        <section className="dashboard-cctv" aria-labelledby="cctv-title"><div className="dashboard-cctv__heading"><div><p className="dashboard__eyebrow">LIVE MONITORING / ZONE OVERVIEW</p><h2 id="cctv-title">CCTV 실시간 모니터링</h2></div><div className="dashboard-cctv__legend" aria-label="감지 표시 범례"><span><i className="dashboard-cctv__legend-fire" />불꽃 감지</span><span><i className="dashboard-cctv__legend-smoke" />연기 감지</span></div></div><div className="dashboard__feeds" aria-label="CCTV 4분할 화면">{cameras.map((camera) => <LiveFrame key={camera.cameraId} camera={camera} />)}{!cameras.length && <p>등록된 카메라를 불러오는 중입니다.</p>}</div></section>
        <aside className="dashboard-statistics" aria-labelledby="statistics-title"><div className="dashboard-statistics__heading"><div><p className="dashboard__eyebrow">SYSTEM OVERVIEW</p><h2 id="statistics-title">관제 현황</h2></div><span>5초마다 갱신</span></div><div className="dashboard-statistics__cards">{statistics.map((statistic) => <article className={`stat-card stat-card--${statistic.tone}${statistic.metrics ? ' stat-card--risk' : ''}`} key={statistic.label}><div className="stat-card__heading"><h3>{statistic.label}</h3><svg className="stat-card__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={statisticIconPaths[statistic.label]} /></svg></div>{statistic.metrics ? <div className="stat-card__risk-content"><div className="stat-card__gauge" aria-label="위험 지수 데이터 미연동" style={{ '--risk-progress': '0deg' }}><div><span>위험 지수</span><strong>—</strong><small>데이터 미연동</small></div></div><div className="stat-card__metrics">{statistic.metrics.map((metric) => <div className={`stat-card__metric stat-card__metric--${metric.tone}`} key={metric.label}><div><span>{metric.label}</span><strong>{metric.value}</strong></div><i aria-hidden="true" style={{ '--metric-fill': '0%' }} /></div>)}</div></div> : <><p className="stat-card__value"><strong>{statistic.eventId ? <Link to={`/history?eventId=${statistic.eventId}`}>{statistic.value}</Link> : statistic.value}</strong>{statistic.unit && <small>{statistic.unit}</small>}</p><p className="stat-card__detail">{statistic.detail}</p>{statistic.footnote && <p className="stat-card__footnote">{statistic.footnote}</p>}</>}</article>)}</div></aside>
      </div>
    </main>
  );
}
