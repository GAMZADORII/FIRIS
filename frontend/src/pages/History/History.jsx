import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient, apiError, fetchMedia } from '../../api/client.js';
import { Badge, Modal, PageHeading } from '../../components/Console/Console.jsx';
import './History.css';

const reasons = { STEAM: '수증기', LIGHT: '빛', REFLECTION: '반사', DUST: '먼지', WELDING: '용접', ETC: '기타' };
const states = { UNREVIEWED: '확인 대기', TRUE_FIRE: '실제 화재', FALSE_POSITIVE: '오탐' };
const types = { FIRE: '화재', SMOKE: '연기', FIRE_SMOKE: '화재·연기' };
const PAGE_SIZE = 10;

export default function History() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ from: '', to: '', eventType: '', reviewStatus: '', cameraId: '' });
  const [cameras, setCameras] = useState([]);
  const [selected, setSelected] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [video, setVideo] = useState(null);
  const [reason, setReason] = useState('ETC');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const eventId = searchParams.get('eventId');

  useEffect(() => {
    let active = true;
    apiClient.get('/api/cameras').then(({ data }) => { if (active) setCameras(data); }).catch((cause) => { if (active) setError(apiError(cause)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    apiClient.get('/api/events', { params: { ...params, page, size: PAGE_SIZE } })
      .then(({ data }) => { if (active) { setItems(data.content); setTotal(data.totalElements); setError(''); } })
      .catch((cause) => { if (active) setError(apiError(cause)); });
    return () => { active = false; };
  }, [filters, page, revision]);
  useEffect(() => {
    if (!eventId) { setSelected(null); return; }
    let active = true;
    const urls = [];
    apiClient.get(`/api/events/${eventId}`).then(async ({ data }) => {
      if (!active) return;
      setSelected(data);
      setSnapshot(null); setVideo(null);
      const [imageResult, videoResult] = await Promise.allSettled([
        data.snapshotPath ? fetchMedia(`/api/events/${eventId}/snapshot`) : Promise.resolve(null),
        data.videoPath ? fetchMedia(`/api/events/${eventId}/video/annotated`).catch((error) => error.response?.status === 404 ? fetchMedia(`/api/events/${eventId}/video`) : Promise.reject(error)) : Promise.resolve(null),
      ]);
      if (imageResult.status === 'fulfilled' && imageResult.value) urls.push(imageResult.value);
      if (videoResult.status === 'fulfilled' && videoResult.value) urls.push(videoResult.value);
      if (active) {
        setSnapshot(imageResult.status === 'fulfilled' ? imageResult.value : null);
        setVideo(videoResult.status === 'fulfilled' ? videoResult.value : null);
      } else urls.forEach(URL.revokeObjectURL);
    }).catch((cause) => { if (active) setError(apiError(cause)); });
    return () => { active = false; urls.forEach(URL.revokeObjectURL); };
  }, [eventId, revision]);

  async function review(result) {
    try {
      await apiClient.patch(`/api/events/${eventId}/review`, { result, falsePositiveReason: result === 'FALSE_POSITIVE' ? reason : null, note: note.trim() || null });
      setRevision((value) => value + 1);
      setError('');
    } catch (cause) { setError(apiError(cause)); }
  }
  function filter(key, value) { setPage(0); setFilters((current) => ({ ...current, [key]: value })); }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <main className="console-page history-page">
    <PageHeading eyebrow="FIRIS EVENT ARCHIVE" title="이벤트 이력 조회"><span className="console-muted">실제 이벤트 기록 · KST</span></PageHeading>
    {error && <p role="alert" className="console-notice">{error}</p>}
    <section className="console-toolbar history-filters" aria-label="이벤트 검색">
      <label>시작일<input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => filter('from', e.target.value)} /></label>
      <label>종료일<input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => filter('to', e.target.value)} /></label>
      <label>CCTV<select value={filters.cameraId} onChange={(e) => filter('cameraId', e.target.value)}><option value="">전체</option>{cameras.map((camera) => <option key={camera.cameraId} value={camera.cameraId}>{camera.cameraName} ({camera.location})</option>)}</select></label>
      <label>유형<select value={filters.eventType} onChange={(e) => filter('eventType', e.target.value)}><option value="">전체</option>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>검수<select value={filters.reviewStatus} onChange={(e) => filter('reviewStatus', e.target.value)}><option value="">전체</option>{Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button onClick={() => { setFilters({ from: '', to: '', eventType: '', reviewStatus: '', cameraId: '' }); setPage(0); }}>초기화</button>
    </section>
    <div className="history-list-heading"><h2>감지 이벤트 목록 <span>{total} RECORDS</span></h2><span className="console-muted">최신 발생 순</span></div>
    <div className="console-table-wrap"><table className="console-table"><thead><tr><th>ID / 발생 시각</th><th>유형</th><th>CCTV / 위치</th><th>신뢰도</th><th>검수</th><th>상세</th></tr></thead><tbody>
      {items.map((event) => <tr key={event.eventId}><td>#{event.eventId}<small>{event.detectedAt?.replace('T', ' ')}</small></td><td><Badge tone={event.eventType === 'FIRE' ? 'red' : 'amber'}>{types[event.eventType] || event.eventType}</Badge></td><td>{event.cameraName}<small>{event.location}</small></td><td>{(event.confidence * 100).toFixed(1)}%</td><td><Badge tone={event.reviewStatus === 'TRUE_FIRE' ? 'red' : event.reviewStatus === 'UNREVIEWED' ? 'amber' : 'green'}>{states[event.reviewStatus] || event.reviewStatus}</Badge></td><td><button onClick={() => setSearchParams({ eventId: String(event.eventId) })}>상세 보기</button></td></tr>)}
      {!items.length && <tr><td colSpan="6" className="console-empty">조회된 이벤트가 없습니다.</td></tr>}
    </tbody></table></div>
    <div className="history-pagination"><span>총 {total}건</span><nav><button disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>다음</button></nav></div>
    {selected && <Modal wide title={`이벤트 #${selected.eventId} 상세`} subtitle={`${selected.cameraName} / ${selected.detectedAt?.replace('T', ' ')}`} onClose={() => setSearchParams({})}>
      <div className="console-modal__body"><p>{types[selected.eventType]} · 신뢰도 {(selected.confidence * 100).toFixed(1)}% · {states[selected.reviewStatus]}</p><p>위치: {selected.location} / 모델: {selected.modelVersion}</p>
        <div className="history-report-grid"><div className="history-capture">{snapshot ? <img src={snapshot} alt="이벤트 스냅샷" /> : <p>스냅샷 준비 중</p>}</div><div>{video ? <video src={video} controls playsInline style={{ width: '100%' }} /> : <p>이벤트 영상 준비 중</p>}</div></div>
        {selected.review ? <p>검수: {states[selected.review.result]} · {selected.review.reviewerName} · {selected.review.falsePositiveReason ? reasons[selected.review.falsePositiveReason] : ''} {selected.review.note}</p> : <div><label>오탐 사유 <select value={reason} onChange={(e) => setReason(e.target.value)}>{Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>검수 메모 <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label></div>}
        {error && <p role="alert">{error}</p>}
      </div><footer className="console-modal__footer">{!selected.review && <><button onClick={() => review('FALSE_POSITIVE')}>오탐으로 검수</button><button className="console-primary" onClick={() => review('TRUE_FIRE')}>실제 화재로 검수</button></>}<button onClick={() => setSearchParams({})}>닫기</button></footer>
    </Modal>}
  </main>;
}
