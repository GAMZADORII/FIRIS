import { useEffect, useRef, useState } from 'react';
import { apiClient, apiError, fetchMedia, getSession } from '../../api/client.js';
import { Modal } from './Console.jsx';

const reasons = { STEAM: '수증기', LIGHT: '빛', REFLECTION: '반사', DUST: '먼지', WELDING: '용접', ETC: '기타' };
export default function FireAlert() {
  const [queue, setQueue] = useState([]);
  const event = queue[0];
  const [stage, setStage] = useState('alert');
  const [clip, setClip] = useState(null);
  const [seconds, setSeconds] = useState(10);
  const [reason, setReason] = useState('ETC');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const deadline = useRef(0);
  const reporter = getSession()?.account;
  const close = () => {
    if (lock.current) return;
    setQueue((items) => items.slice(1));
    setStage('alert'); setError('');
    window.dispatchEvent(new Event('firis-events-changed'));
  };
  useEffect(() => {
    let active = true, polling = false;
    let seen = null;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const first = (await apiClient.get('/api/events', { params: { page: 0, size: 100 } })).data;
        const all = [...first.content];
        for (let page = 1; page < Math.ceil(first.totalElements / 100); page++) {
          all.push(...(await apiClient.get('/api/events', { params: { page, size: 100 } })).data.content);
        }
        if (!active) return;
        if (seen) {
          const added = all.filter((item) => !seen.has(item.eventId) && item.reviewStatus === 'UNREVIEWED');
          if (added.length) setQueue((items) => [...items, ...added.reverse()]);
        }
        seen = new Set([...(seen || []), ...all.map((item) => item.eventId)]);
      } catch { /* Retry on next poll; do not create an alert from failed requests. */ }
      finally { polling = false; }
    };
    const open = ({ detail }) => {
      if (detail?.preview && !import.meta.env.DEV) return;
      if (detail) setQueue((items) => items.some((item) => item.eventId === detail.eventId) ? items : [...items, detail]);
    };
    window.addEventListener('firis-open-fire-alert', open);
    poll();
    const timer = setInterval(poll, 5000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('firis-open-fire-alert', open); };
  }, []);
  useEffect(() => {
    setClip(null); setReason('ETC');
    if (!event || event.preview) return;
    let active = true, url, polling = false;
    const load = async () => {
      if (polling || url) return;
      polling = true;
      try {
        const { data } = await apiClient.get(`/api/events/${event.eventId}`);
        if (!data.videoPath) return;
        const next = await fetchMedia(`/api/events/${event.eventId}/video/annotated`).catch((cause) => {
          if (cause.response?.status === 404) return fetchMedia(`/api/events/${event.eventId}/video`);
          throw cause;
        });
        if (!active) URL.revokeObjectURL(next);
        else { url = next; setClip(next); }
      } catch { /* The clip may still be being generated. */ }
      finally { polling = false; }
    };
    load(); const timer = setInterval(load, 2000);
    return () => { active = false; clearInterval(timer); if (url) URL.revokeObjectURL(url); };
  }, [event]);
  useEffect(() => {
    if (!event || stage !== 'alert') return;
    deadline.current = Date.now() + 10000; setSeconds(10);
    let active = true;
    const reset = () => { if (!lock.current) { deadline.current = Date.now() + 10000; setSeconds(10); } };
    const actions = ['pointerdown', 'keydown', 'input', 'wheel'];
    actions.forEach((name) => document.addEventListener(name, reset, true));
    const timer = setInterval(async () => {
      if (lock.current) return;
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining) return;
      lock.current = true; setBusy(true);
      try {
        if (!event.preview) await apiClient.post(`/api/events/${event.eventId}/report-timeout`);
        if (active) { lock.current = false; close(); }
      } catch (cause) {
        if (active) { setError(`무응답 기록 저장 실패: ${apiError(cause)}`); setStage('timeout-error'); }
      } finally { lock.current = false; if (active) setBusy(false); }
    }, 250);
    return () => { active = false; clearInterval(timer); actions.forEach((name) => document.removeEventListener(name, reset, true)); };
  }, [event, stage]);
  async function falsePositive() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (!event.preview) await apiClient.patch(`/api/events/${event.eventId}/review`, { result: 'FALSE_POSITIVE', falsePositiveReason: reason });
      lock.current = false; close();
    } catch (cause) { setError(apiError(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function completeResponse() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (!event.preview) await apiClient.post(`/api/events/${event.eventId}/response-complete`);
      lock.current = false; close();
    } catch (cause) { setError(apiError(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!event) return null;
  return <Modal key={stage === 'report' ? 'report' : 'alert'} wide={stage !== 'report'} title={stage === 'report' ? '119 신고 정보를 확인해주세요.' : '화재 의심 이벤트 감지'} subtitle={`EVT-${event.eventId} · ${event.cameraName || event.cameraId || ''}`} onClose={close}>
    <div className="console-modal__body">
      {event.preview && <p>미리보기 · 실제 이벤트 변경 및 신고 전송 없음</p>}
      {stage === 'report' ? <>
        <dl className="history-report-confirm">
          <div><dt>사고유형</dt><dd>화재</dd></div>
          <div><dt>주소</dt><dd>{event.address || '미등록'}</dd></div>
          <div><dt>상세위치</dt><dd>{event.location || '미등록'}</dd></div>
          <div><dt>탐지시간</dt><dd>{event.detectedAt?.replace('T', ' ')}</dd></div>
          <div><dt>담당자</dt><dd>{reporter?.name || '미등록'} / {reporter?.phoneNumber || reporter?.phone || '연락처 미등록'}</dd></div>
          <div><dt>특이사항</dt><dd>{event.specialNotes || '미등록'}</dd></div>
        </dl><p>119 모의 서버 연결 준비 중입니다. 신고는 아직 전송되지 않았습니다.</p>
      </> : <>
        <p>{event.location || '위치 미등록'} · {event.detectedAt?.replace('T', ' ')}</p>
        {clip ? <video src={clip} controls autoPlay muted playsInline aria-label="화재 이벤트 영상 클립" style={{ width: '100%', maxHeight: '45vh', background: '#000' }} /> : <p className="console-empty">{event.preview ? '미리보기에는 저장된 영상 클립이 없습니다.' : '이벤트 영상 클립 준비 중…'}</p>}
        {stage === 'alert' && <p>{busy ? '무응답 기록 저장 중…' : `${seconds}초 동안 조작이 없으면 자동으로 닫힙니다.`}</p>}
        {stage === 'false-positive' && <label>오탐 사유 <select value={reason} onChange={(e) => setReason(e.target.value)}>{Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        {stage === 'complete' && <p>현장 대응이 완료되었나요? 화재 확정 및 대응 완료로 기록합니다. 119 신고는 전송하지 않습니다.</p>}
        {queue.length > 1 && <p>추가 확인 대기 {queue.length - 1}건</p>}
      </>}
      {error && <p role="alert">{error}</p>}
    </div>
    <footer className="console-modal__footer">
      {stage === 'report' ? <><button onClick={() => setStage('alert')}>취소</button><button className="console-primary" disabled title="119 모의 서버 연동 예정">119 신고 연결</button></> : <>
        <button disabled={busy} onClick={close}>닫기</button>
        {stage === 'timeout-error' && <button onClick={() => { setError(''); setStage('alert'); }}>자동 닫힘 재시도</button>}
        {(stage === 'false-positive' || stage === 'complete') && <button disabled={busy} onClick={() => setStage('alert')}>취소</button>}
        <button disabled={busy || Boolean(event.responseCompletedAt)} onClick={() => stage === 'complete' ? completeResponse() : setStage('complete')}>{stage === 'complete' ? '대응 완료 확정' : '대응 완료'}</button>
        <button disabled={busy || event.reviewStatus === 'TRUE_FIRE'} title={event.reviewStatus === 'TRUE_FIRE' ? '이미 최종 검수된 이벤트입니다.' : undefined} onClick={() => stage === 'false-positive' ? falsePositive() : setStage('false-positive')}>{stage === 'false-positive' ? '오탐 처리 확정' : '오탐'}</button>
        <button disabled={busy} className="console-primary" onClick={() => { setError(''); setStage('report'); }}>119 신고</button>
      </>}
    </footer>
  </Modal>;
}
