import { useEffect, useState } from 'react';
import { apiClient, fetchMedia } from '../../api/client.js';

export default function EventAlertMedia({ event }) {
  const [snapshot, setSnapshot] = useState(null);
  const [frame, setFrame] = useState(null);
  const [clip, setClip] = useState(null);
  const [mode, setMode] = useState('live');
  const [liveStatus, setLiveStatus] = useState('실시간 화면 연결 중');
  const [clipStatus, setClipStatus] = useState('이벤트 영상 저장 중');
  const [playbackError, setPlaybackError] = useState(false);

  useEffect(() => {
    if (event.preview) return;
    let active = true;
    let url;
    const controller = new AbortController();
    fetchMedia(`/api/events/${event.eventId}/snapshot`, controller.signal).then(next => {
      if (!active) { URL.revokeObjectURL(next); return; }
      url = next;
      setSnapshot(next);
    }).catch(() => { /* Live frames remain available if the snapshot fails. */ });
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [event.eventId, event.preview]);

  useEffect(() => {
    if (event.preview || mode !== 'live') return;
    if (!event.cameraId) { setLiveStatus('연결할 CCTV 정보가 없습니다'); return; }
    let active = true, polling = false, currentUrl;
    const controller = new AbortController();
    async function update() {
      if (polling) return;
      polling = true;
      let next;
      try {
        next = await fetchMedia(`/api/cameras/${encodeURIComponent(event.cameraId)}/frame`, controller.signal);
        const image = new Image();
        image.src = next;
        await image.decode();
        if (!active) { URL.revokeObjectURL(next); return; }
        const previous = currentUrl;
        currentUrl = next;
        setFrame(next);
        setLiveStatus('실시간 CCTV');
        if (previous) URL.revokeObjectURL(previous);
      } catch {
        if (next) URL.revokeObjectURL(next);
        if (active) {
          setFrame(null);
          setLiveStatus('실시간 연결 대기 · 감지 스냅샷 표시');
        }
      } finally { polling = false; }
    }
    update();
    const timer = window.setInterval(update, 250);
    return () => {
      active = false; controller.abort(); window.clearInterval(timer);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [event.cameraId, event.preview, mode]);

  useEffect(() => {
    if (event.preview) return;
    let active = true, polling = false, url;
    const controller = new AbortController();
    async function load() {
      if (polling || url) return;
      polling = true;
      try {
        const { data } = await apiClient.get(`/api/events/${event.eventId}`, { signal: controller.signal });
        if (!active) return;
        if (!data.videoPath) { setClipStatus('이벤트 영상 저장 중'); return; }
        setClipStatus('저장된 영상 불러오는 중');
        const next = await fetchMedia(`/api/events/${event.eventId}/video/annotated`, controller.signal).catch(cause => {
          if (cause.response?.status === 404) return fetchMedia(`/api/events/${event.eventId}/video`, controller.signal);
          throw cause;
        });
        if (!active) { URL.revokeObjectURL(next); return; }
        url = next;
        setClip(next);
        setClipStatus('감지 시점 영상 준비 완료');
      } catch {
        if (active) setClipStatus('영상 연결 재시도 중');
      } finally { polling = false; }
    }
    load();
    const timer = window.setInterval(load, 2000);
    return () => {
      active = false; controller.abort(); window.clearInterval(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [event.eventId, event.preview]);

  if (event.preview) return <p className="console-empty">미리보기에는 실시간 화면과 저장된 영상이 없습니다.</p>;
  return <section className="event-alert-media" aria-label="화재 현장 화면">
    <div className="event-alert-media__viewport">
      {mode === 'clip' && clip ? <video src={clip} controls autoPlay muted playsInline
        aria-label="화재 이벤트 영상 클립" onError={() => setPlaybackError(true)} />
        : (frame || snapshot) ? <img src={frame || snapshot} alt={frame ? '해당 CCTV의 현재 화면' : '이벤트 감지 당시 스냅샷'} />
          : <p>감지 화면을 불러오는 중입니다.</p>}
      <span className="event-alert-media__label">{mode === 'clip' ? '감지 시점 영상' : frame ? '실시간 CCTV' : '감지 스냅샷'}</span>
    </div>
    <div className="event-alert-media__controls">
      <button type="button" aria-pressed={mode === 'live'} onClick={() => {
        setFrame(null); setMode('live'); setPlaybackError(false);
      }}>실시간 CCTV 보기</button>
      <button type="button" disabled={!clip} aria-pressed={mode === 'clip'} onClick={() => {
        setMode('clip'); setPlaybackError(false);
      }}>감지 시점 영상 보기</button>
    </div>
    <p role="status">{mode === 'live' ? `${liveStatus} · ${clipStatus}` : playbackError
      ? '클립을 재생할 수 없습니다. 실시간 CCTV 화면을 확인해주세요.' : '저장된 이벤트 영상 · 현재 실시간 화면이 아닙니다.'}</p>
  </section>;
}
