import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient, apiError, fetchMedia } from '../../api/client.js';
import { Badge, Modal, PageHeading, downloadFile } from '../../components/Console/Console.jsx';
import './History.css';

const PAGE_SIZE = 3;
const reasons = { STEAM: '수증기', LIGHT: '빛', REFLECTION: '반사', DUST: '먼지', WELDING: '용접', ETC: '기타' };
const states = { UNREVIEWED: '미처리', TRUE_FIRE: '처리완료', FALSE_POSITIVE: '오탐' };
const types = { FIRE: '화재', SMOKE: '연기', FIRE_SMOKE: '화재·연기' };
const tone = (status) => status === 'TRUE_FIRE' ? 'green' : status === 'UNREVIEWED' ? 'amber' : '';
const date = (value) => value?.replace('T', ' ') || '—';

export default function History() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('전체');
  const [status, setStatus] = useState('전체');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [video, setVideo] = useState(null);
  const [reason, setReason] = useState('ETC');
  const [note, setNote] = useState('');
  const [showFalsePositiveForm, setShowFalsePositiveForm] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const selectedId = searchParams.get('eventId');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const first = (await apiClient.get('/api/events', { params: { page: 0, size: 100 } })).data;
        const pages = Math.ceil(first.totalElements / 100);
        const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) =>
          apiClient.get('/api/events', { params: { page: index + 1, size: 100 } })));
        if (active) { setEvents([ ...first.content, ...rest.flatMap(({ data }) => data.content) ]); setError(''); }
      } catch (cause) { if (active) setError(apiError(cause)); }
    }
    load();
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    if (!selectedId) { setSelected(null); setSnapshot(null); setVideo(null); return; }
    setShowFalsePositiveForm(false);
    setShowVideo(false);
    let active = true;
    const urls = [];
    apiClient.get(`/api/events/${selectedId}`).then(async ({ data }) => {
      if (!active) return;
      setSelected(data);
      setSnapshot(null); setVideo(null);
      const [imageResult, videoResult] = await Promise.allSettled([
        data.snapshotPath ? fetchMedia(`/api/events/${selectedId}/snapshot`) : Promise.resolve(null),
        data.videoPath ? fetchMedia(`/api/events/${selectedId}/video/annotated`).catch((error) => error.response?.status === 404 ? fetchMedia(`/api/events/${selectedId}/video`) : Promise.reject(error)) : Promise.resolve(null),
      ]);
      if (imageResult.status === 'fulfilled' && imageResult.value) urls.push(imageResult.value);
      if (videoResult.status === 'fulfilled' && videoResult.value) urls.push(videoResult.value);
      if (active) {
        setSnapshot(imageResult.status === 'fulfilled' ? imageResult.value : null);
        setVideo(videoResult.status === 'fulfilled' ? videoResult.value : null);
      } else urls.forEach(URL.revokeObjectURL);
    }).catch((cause) => { if (active) setError(apiError(cause)); });
    return () => { active = false; urls.forEach(URL.revokeObjectURL); };
  }, [selectedId, revision]);

  async function review(result) {
    try {
      await apiClient.patch(`/api/events/${selectedId}/review`, { result, falsePositiveReason: result === 'FALSE_POSITIVE' ? reason : null, note: note.trim() || null });
      setRevision((value) => value + 1);
      setError('');
    } catch (cause) { setError(apiError(cause)); }
  }
  const filtered = events.filter((event) => {
    const haystack = `${event.eventId} ${event.location} ${event.cameraName} ${event.cameraId}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) &&
      (type === '전체' || types[event.eventType] === type) &&
      (status === '전체' || states[event.reviewStatus] === status) &&
      (!start || event.detectedAt?.slice(0, 10) >= start) &&
      (!end || event.detectedAt?.slice(0, 10) <= end);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleEvents = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const summary = [
    ['전체 이벤트', events.length, 'TOTAL EVENTS'],
    ['화재 감지', events.filter((event) => event.eventType === 'FIRE' || event.eventType === 'FIRE_SMOKE').length, 'FIRE DETECTED'],
    ['미처리', events.filter((event) => event.reviewStatus === 'UNREVIEWED').length, 'UNPROCESSED'],
    ['처리완료', events.filter((event) => event.reviewStatus !== 'UNREVIEWED').length, 'RESOLVED'],
  ];
  function exportEvents() {
    const header = '이벤트 ID,발생 시각,채널,위치,유형,신뢰도,상태';
    const rows = filtered.map((event) => [event.eventId, date(event.detectedAt), event.cameraName, event.location, types[event.eventType], (event.confidence * 100).toFixed(1), states[event.reviewStatus]].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','));
    downloadFile('FIRIS-이벤트-이력.csv', [header, ...rows].join('\r\n'), 'text/csv;charset=utf-8');
  }
  function downloadReport() {
    if (!selected) return;
    const lines = [
      'FIRIS 사고 상세 리포트',
      `이벤트 ID: ${selected.eventId}`,
      `발생 시각: ${date(selected.detectedAt)}`,
      `CCTV: ${selected.cameraName} (${selected.cameraId})`,
      `위치: ${selected.location || '미등록'}`,
      `감지 유형: ${types[selected.eventType] || selected.eventType}`,
      `AI 신뢰도: ${(selected.confidence * 100).toFixed(1)}%`,
      `모델 버전: ${selected.modelVersion || '미기록'}`,
      `검수 상태: ${states[selected.reviewStatus] || selected.reviewStatus}`,
      `검수자: ${selected.review?.reviewerName || '미검수'}`,
      `오탐 사유: ${reasons[selected.review?.falsePositiveReason] || '해당 없음'}`,
      `검수 메모: ${selected.review?.note || '없음'}`,
    ];
    downloadFile(`FIRIS-이벤트-${selected.eventId}.txt`, lines.join('\n'));
  }

  return <main className="console-page history-page">
    <PageHeading eyebrow="FIRIS EVENT ARCHIVE / INCIDENT INTELLIGENCE" title="이벤트 이력 조회"><span className="console-muted">실제 이벤트 기록 · KST 기준</span><button onClick={exportEvents}>↓ 이력 내보내기</button></PageHeading>
    {error && <p role="alert" className="console-notice">{error}</p>}
    <section className="history-summary" aria-label="이벤트 요약">{summary.map(([label, value, english], index) => <article key={label} className={`history-summary__card history-summary__card--${index}`}><span>{label}</span><strong>{String(value).padStart(2, '0')}<small>건</small></strong><p>{english}</p></article>)}</section>
    <section className="console-toolbar history-filters" aria-label="이벤트 검색" onChange={() => setPage(1)}>
      <label>조회 기간<div className="history-date-range"><input aria-label="조회 시작일" type="date" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} /><span>—</span><input aria-label="조회 종료일" type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} /></div></label>
      <label>감지 유형<select value={type} onChange={(event) => setType(event.target.value)}>{['전체', '화재', '연기', '화재·연기'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>처리 상태<select value={status} onChange={(event) => setStatus(event.target.value)}>{['전체', '미처리', '처리완료', '오탐'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="history-filters__search">이벤트 검색<input placeholder="이벤트 ID, 위치, CCTV 검색…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <button onClick={() => { setQuery(''); setType('전체'); setStatus('전체'); setStart(''); setEnd(''); setPage(1); }}>초기화</button>
    </section>
    <div className="history-list-heading"><h2>감지 이벤트 목록 <span>{filtered.length} RECORDS</span></h2><span className="console-muted">최신 발생 순</span></div>
    <div className="console-table-wrap"><table className="console-table"><thead><tr>{['이벤트 ID / 발생 시각', '감지 유형', '감지 위치 / 채널', 'AI 신뢰도', '처리 상태', '담당 요원', '상세 기록'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
      {visibleEvents.map((event) => <tr key={event.eventId}><td><strong className="console-mono">EVT-{event.eventId}</strong><small className="console-mono">{date(event.detectedAt)}</small></td><td><Badge tone={event.eventType === 'FIRE' ? 'red' : 'amber'}>{types[event.eventType]} 감지</Badge></td><td>{event.location}<small>{event.cameraName}</small></td><td className="console-mono">{(event.confidence * 100).toFixed(1)}%<div className="history-confidence"><i style={{ width: `${Math.max(0, Math.min(100, event.confidence * 100))}%` }} /></div></td><td><Badge tone={tone(event.reviewStatus)}>{states[event.reviewStatus]}</Badge></td><td>{event.reviewStatus === 'UNREVIEWED' ? '미배정' : '검수 완료'}</td><td><button onClick={() => setSearchParams({ eventId: String(event.eventId) })}>리포트 열기 ↗</button></td></tr>)}
      {!filtered.length && <tr><td colSpan="7" className="console-empty">검색 조건에 맞는 이벤트가 없습니다.</td></tr>}
    </tbody></table></div>
    <div className="history-pagination"><span className="console-muted" aria-live="polite">총 {filtered.length}건 중 {filtered.length ? pageStart + 1 : 0}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}건 표시</span><nav aria-label="이벤트 목록 페이지"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹ 이전</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} aria-label={`${number}페이지`} aria-current={currentPage === number ? 'page' : undefined} disabled={!filtered.length} onClick={() => setPage(number)}>{number}</button>)}<button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>다음 ›</button></nav><span className="console-muted history-pagination__signature">FIRIS / EVENT AUDIT LOG</span></div>
    {selected && <Modal
      wide
      title={`${selected.eventType === 'FIRE' ? '긴급 화재' : selected.eventType === 'SMOKE' ? '연기' : '화재·연기'} 감지 상세 리포트`}
      subtitle={`MISSION CRITICAL INCIDENT LOG / EVT-${selected.eventId}`}
      onClose={() => setSearchParams({})}
    >
      <div className="console-modal__body">
        <div className="history-report-meta">
          <span>분석 화면 캡처</span>
          <span>{selected.cameraName} / {date(selected.detectedAt)}</span>
        </div>
        <div className="history-report-grid">
          <div className="history-capture">
            {showVideo && video
              ? <video src={video} controls playsInline aria-label="이벤트 영상" />
              : snapshot ? <img src={snapshot} alt={`${selected.location} CCTV 화면`} /> : <p>스냅샷 준비 중</p>}
            {!showVideo && <span className="history-capture__label">◉ ANALYSIS</span>}
            <small>{selected.location}</small>
            {video && <button type="button" className="history-capture__media-toggle" onClick={() => setShowVideo((value) => !value)}>{showVideo ? '캡처 보기' : '이벤트 영상 보기'}</button>}
          </div>
          <div className="history-telemetry">
            <p>AI 탐지 정보 (DETECTION DATA)</p>
            <div className="history-metrics">
              <div><span>AI 분석 신뢰도</span><strong>{(selected.confidence * 100).toFixed(1)}%</strong></div>
              <div className="history-metric--duration"><span>이벤트 영상 구간</span><strong>{selected.videoPath && selected.preSeconds != null && selected.postSeconds != null ? `전 ${selected.preSeconds}초 · 후 ${selected.postSeconds}초` : '영상 없음'}</strong></div>
            </div>
            <div className="history-assignee">
              <span>●　{selected.review?.reviewerName || '미배정'}<small>검수 담당 관제 요원</small></span>
              <Badge tone={tone(selected.reviewStatus)}>{states[selected.reviewStatus]}</Badge>
            </div>
          </div>
        </div>
        <section className="history-timeline">
          <div><h3>◷ 사고 대응 블랙박스 기록</h3><span>KST TIMESTAMP</span></div>
          <ol>
            <li><time>{selected.detectedAt?.slice(11) || '—'}</time><strong>{types[selected.eventType]} 패턴 포착</strong><small>CCTV 영상 분석 시작</small></li>
            <li><time>시각 미기록</time><strong>AI 검증 완료</strong><small>신뢰도 {(selected.confidence * 100).toFixed(1)}% 기록</small></li>
            <li><time>시각 미기록</time><strong>관제 이벤트 생성</strong><small>이벤트 #{selected.eventId}</small></li>
            <li className="history-timeline__current"><time>현재 상태</time><strong>{states[selected.reviewStatus]}</strong><small>{selected.review ? `검수자 ${selected.review.reviewerName}` : '관제 요원 확인 대기'}</small></li>
          </ol>
        </section>
        {selected.review
          ? <p className="console-muted">검수 결과: {states[selected.review.result]} · {reasons[selected.review.falsePositiveReason] || '사유 없음'} {selected.review.note || ''}</p>
          : showFalsePositiveForm
            ? <div className="history-review-form"><label>오탐 사유<select value={reason} onChange={(event) => setReason(event.target.value)}>{Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>검수 메모<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></label><span>사유를 선택한 뒤 아래의 오탐 처리 버튼을 다시 누르세요.</span></div>
            : <p className="console-muted">검수 결과는 서버에 저장되며, 최종 검수 후 변경할 수 없습니다.</p>}
        {error && <p role="alert" className="console-notice">{error}</p>}
      </div>
      <footer className="console-modal__footer">
        <button onClick={() => showFalsePositiveForm ? review('FALSE_POSITIVE') : setShowFalsePositiveForm(true)} disabled={Boolean(selected.review)}>오탐 처리로 변경</button>
        <button disabled title="최종 검수 취소 API 미구현">미처리로 변경</button>
        <button onClick={downloadReport}>↓ 리포트 다운로드</button>
        <button onClick={() => setSearchParams({})}>창 닫기</button>
        <button className="console-primary" onClick={() => review('TRUE_FIRE')} disabled={Boolean(selected.review)}>✓ 처리완료로 변경</button>
      </footer>
    </Modal>}
  </main>;
}
