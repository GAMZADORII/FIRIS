import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, apiError, fetchMedia } from '../../api/client.js';
import './Dashboard.css';

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
      try {
        const next = await fetchMedia(`/api/cameras/${encodeURIComponent(camera.cameraId)}/frame`, controller.signal);
        if (!active) { URL.revokeObjectURL(next); return; }
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        currentUrl = next;
        setFrame(next);
        setState('AI 분석 중');
      } catch (error) {
        if (!active) return;
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        currentUrl = null;
        setFrame(null);
        setState(error.response?.status === 404 ? 'AI 영상 대기' : 'AI 분석 화면 연결 대기');
      } finally { polling = false; }
    }
    update();
    const timer = window.setInterval(update, 350);
    return () => { active = false; window.clearInterval(timer); controller?.abort(); if (currentUrl) URL.revokeObjectURL(currentUrl); };
  }, [camera.cameraId]);

  return <article className="camera-feed">
    <div className="camera-feed__heading"><div className="camera-feed__name"><span className="camera-feed__status-dot" aria-hidden="true" /><h3>{camera.cameraName}</h3><span className="camera-feed__location">[{camera.location || '위치 미등록'}]</span></div><span className="camera-feed__format">{camera.status}</span></div>
    <div className="camera-feed__viewport" aria-label={`${camera.cameraName} AI 분석 화면`}>
      {frame && <img className="camera-feed__image" src={frame} alt={`${camera.cameraName} 불꽃·연기 탐지 화면`} />}
      <div className="camera-feed__viewport-status"><span>{state}</span><span>{camera.cameraId}</span></div>
    </div>
    <div className="camera-feed__footer"><span>{camera.cameraId}</span><span>FIRE · SMOKE 탐지</span></div>
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

  const cards = [
    ['오늘 발생 이벤트', counts.today], ['미검수 이벤트', counts.unreviewed],
    ['실제 화재', counts.fire], ['오탐', counts.falsePositive],
    ['ONLINE CCTV', cameras.filter((camera) => camera.status === 'ONLINE').length],
  ];
  return <main className="dashboard">
    <section className="dashboard-hero" aria-labelledby="dashboard-title"><div className="dashboard-hero__copy"><div className="dashboard-hero__meta"><span className="dashboard-hero__status">SYSTEM LIVE</span><span>AI · Backend 관제 연동</span></div><h1 id="dashboard-title">종합 화재 관제 모니터링 콘솔</h1><p>카메라 4대의 AI 분석 화면과 이벤트 현황</p></div><div className="dashboard-hero__clock"><span>LOCAL TIME</span><strong>{now.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })}</strong></div></section>
    {error && <p role="alert" className="console-notice">{error}</p>}
    <div className="dashboard-layout"><section className="dashboard-cctv" aria-labelledby="cctv-title"><div className="dashboard-cctv__heading"><div><p className="dashboard__eyebrow">LIVE MONITORING</p><h2 id="cctv-title">CCTV 실시간 모니터링</h2></div></div><div className="dashboard__feeds" aria-label="CCTV 4분할 화면">{cameras.map((camera) => <LiveFrame key={camera.cameraId} camera={camera} />)}{!cameras.length && <p>등록된 카메라를 불러오는 중입니다.</p>}</div></section>
      <aside className="dashboard-statistics"><div className="dashboard-statistics__heading"><div><p className="dashboard__eyebrow">SYSTEM OVERVIEW</p><h2>관제 현황</h2></div><span>5초마다 갱신</span></div><div className="dashboard-statistics__cards">{cards.map(([label, value]) => <article className="stat-card" key={label}><div className="stat-card__heading"><h3>{label}</h3></div><p className="stat-card__value"><strong>{value}</strong><small>{label.includes('CCTV') ? '대' : '건'}</small></p></article>)}<article className="stat-card"><div className="stat-card__heading"><h3>최근 위험 이벤트</h3></div>{events.slice(0, 2).map((event) => <p key={event.eventId}><Link to={`/history?eventId=${event.eventId}`}>{event.cameraName} · {event.eventType} · {event.detectedAt?.replace('T', ' ')}</Link></p>)}{!events.length && <p>발생한 이벤트가 없습니다.</p>}</article></div></aside></div>
  </main>;
}
