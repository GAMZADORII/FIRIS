import { useEffect, useRef, useState } from 'react';
import { apiClient, apiError, fetchMedia, getSession } from '../../api/client.js';
import { Modal } from './Console.jsx';
import { connectCenter } from '../../api/mock119Socket.js';
import { cameraDisplayName } from '../../utils/cameraChannels.js';
import { formatPhone } from '../../utils/phone.js';

const reasons = { STEAM: '수증기', LIGHT: '빛', REFLECTION: '반사', DUST: '먼지', WELDING: '용접', ETC: '기타' };
export default function FireAlert() {
  const [queue, setQueue] = useState([]);
  const event = queue[0];
  const currentEventId = useRef(null);
  currentEventId.current = event?.eventId;
  const [stage, setStage] = useState('alert');
  const [clip, setClip] = useState(null);
  const [seconds, setSeconds] = useState(10);
  const [reason, setReason] = useState('ETC');
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [reportError, setReportError] = useState('');
  const [delivery, setDelivery] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const deadline = useRef(0);
  const close = () => {
    if (lock.current) return;
    setQueue((items) => items.slice(1));
    setStage('alert'); setError('');
    window.dispatchEvent(new Event('firis-events-changed'));
  };
  const dismissReport = (eventId) => {
    setQueue(items => items.filter(item => item.eventId !== eventId));
    if (currentEventId.current === eventId) { setStage('alert'); setError(''); }
    window.dispatchEvent(new Event('firis-events-changed'));
  };
  useEffect(() => {
    let active = true, polling = false;
    let latestEventId = null;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        if (latestEventId === null) {
          // Existing events are the initial baseline, not new alerts.
          const { data } = await apiClient.get('/api/events/latest-id');
          if (active) latestEventId = data.latestEventId;
          return;
        }
        const added = [];
        let nextId = latestEventId;
        for (let batch = 0; batch < 10; batch++) {
          const { data } = await apiClient.get('/api/events', {
            params: { page: 0, size: 100, afterEventId: nextId },
          });
          if (!active) return;
          if (!data.content.length) break;
          added.push(...data.content);
          nextId = data.content[data.content.length - 1].eventId;
          if (data.content.length < 100) break;
        }
        latestEventId = nextId;
        const alerts = added.filter((item) => item.reviewStatus === 'UNREVIEWED' && !item.responseCompletedAt);
        if (alerts.length) setQueue((items) => [...items, ...alerts.filter(
          (alert) => !items.some((item) => item.eventId === alert.eventId)
        )]);
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
    setReportData(null); setReportError(''); setDelivery(null);
    if (!event || stage !== 'report') return;
    if (event.preview) {
      const account = getSession()?.account;
      setReportData({ eventType: 'FIRE', siteAddress: event.address,
        controlRoomPhone: event.controlRoomPhone, detailLocation: event.location,
        detectedAt: event.detectedAt, reporterName: account?.name,
        reporterPhone: account?.contactPhone, specialNotes: event.specialNotes });
      return;
    }
    let active = true;
    apiClient.get(`/api/events/${event.eventId}/mock-119-preview`)
      .then(({ data }) => { if (active) setReportData(data); })
      .catch((cause) => { if (active) setReportError(apiError(cause)); });
    return () => { active = false; };
  }, [event, stage]);
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
  useEffect(() => connectCenter(async (notification) => {
    window.dispatchEvent(new Event('firis-events-changed'));
    const id = notification?.eventId ?? currentEventId.current;
    if (!id || id === 'PREVIEW') return;
    try {
      const { data } = await apiClient.get(`/api/events/${id}`);
      if (data.responseCompletedAt) {
        setQueue(items => items.filter(item => item.eventId !== id));
        if (currentEventId.current === id) setStage('alert');
      }
    } catch { /* Recovered on the next connection or status query. */ }
  }), []);
  useEffect(() => {
    if (!event || event.preview || stage !== 'report') return;
    let active = true;
    async function status() {
      try {
        const { data } = await apiClient.get(`/api/events/${event.eventId}/mock-119-report`);
        if (!active) return;
        setDelivery(data);
        if (data.status === 'ACCEPTED' || data.responseStatus === 'CLOSED') dismissReport(event.eventId);
      } catch { /* A report may not have been submitted yet. */ }
    }
    status(); const timer = setInterval(status, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [event, stage]);
  async function submitReport() {
    if (lock.current || event.preview || !reportData?.readyToReport) return;
    const eventId = event.eventId;
    lock.current = true; setBusy(true); setReportError('');
    try {
      const { data } = await apiClient.post(`/api/events/${eventId}/mock-119-reports`);
      if (currentEventId.current === eventId) setDelivery(data);
      if (data.status === 'ACCEPTED') dismissReport(eventId);
      window.dispatchEvent(new Event('firis-events-changed'));
    } catch (cause) { setReportError(apiError(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
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
  return <Modal key={stage === 'report' ? 'report' : 'alert'} wide={stage !== 'report'} title={stage === 'report' ? '119 신고 정보를 확인해주세요.' : '화재 의심 이벤트 감지'} subtitle={`EVT-${event.eventId} · ${cameraDisplayName(event.cameraId, event.cameraName)}`} onClose={close}>
    <div className="console-modal__body">
      {event.preview && <p>미리보기 · 실제 이벤트 변경 및 신고 전송 없음</p>}
      {stage === 'report' ? <>
        {reportData ? <dl className="history-report-confirm">
          <div><dt>사고유형</dt><dd>{{ FIRE: '화재', SMOKE: '연기', FIRE_SMOKE: '화재·연기' }[reportData?.eventType] || '확인 중'}</dd></div>
          <div><dt>주소</dt><dd>{reportData?.siteAddress || '미등록'}</dd></div>
          <div><dt>관제실 번호</dt><dd>{formatPhone(reportData?.controlRoomPhone)}</dd></div>
          <div><dt>상세위치</dt><dd>{reportData?.detailLocation || '미등록'}</dd></div>
          <div><dt>탐지시간</dt><dd>{reportData?.detectedAt?.replace('T', ' ') || '확인 중'}</dd></div>
          <div><dt>담당자</dt><dd>{reportData?.reporterName || '미등록'} / {formatPhone(reportData?.reporterPhone, '연락처 미등록')}</dd></div>
          <div><dt>특이사항</dt><dd>{reportData?.specialNotes || '특이사항 없음'}</dd></div>
        </dl> : <p role={reportError ? 'alert' : undefined}>{reportError ? `신고 정보 조회 실패: ${reportError}` : '신고 정보를 불러오는 중입니다.'}</p>}
        {delivery ? <p role="status">모의 신고: {({ PENDING: '등록 처리 중', ACCEPTED: '센터에 등록됨', FAILED: '등록 실패' })[delivery.status]} {delivery.receiptId} · {({ PENDING: '신규 신고', DISPATCHED: '출동 중', ARRIVED: '현장 도착', CLOSED: '대응 완료' })[delivery.responseStatus]}</p> : <p>119 모의 접수센터로 전달합니다. 실제 119 신고가 아닙니다.</p>}
        {reportData && !reportData.readyToReport && <p>입력한 신고 정보의 형식을 확인해주세요: {reportData.missingFields?.join(', ')}</p>}
        {reportError && reportData && <p role="alert">{reportError}</p>}
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
      {stage === 'report' ? <><button onClick={() => setStage('alert')}>취소</button><button className="console-primary" disabled={busy || event.preview || (delivery?.status !== 'ACCEPTED' && !reportData?.readyToReport)} onClick={delivery?.status === 'ACCEPTED' ? close : submitReport}>{busy ? '등록 중…' : delivery?.status === 'ACCEPTED' ? '센터 등록 완료' : '모의 신고 전송'}</button></> : <>
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
