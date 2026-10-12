import { useEffect, useState } from 'react';
import { API_BASE } from '../api/client.js';

export default function EventVideo({ report }) {
  const [source, setSource] = useState(null);
  useEffect(() => {
    let alive = true, url = null, busy = false;
    const controller = new AbortController();
    async function load() {
      if (busy || url) return;
      busy = true;
      try {
        const base = `${API_BASE}/api/mock-119-center/reports/${report.reportId}/video`;
        let response = await fetch(base + '?annotated=true', { signal: controller.signal });
        if (response.status === 404) response = await fetch(base, { signal: controller.signal });
        if (!response.ok) return;
        const next = URL.createObjectURL(await response.blob());
        if (!alive) URL.revokeObjectURL(next);
        else { url = next; setSource(next); }
      } catch { /* The event clip can still be in preparation. */ }
      finally { busy = false; }
    }
    setSource(null); load(); const timer = setInterval(load, 3000);
    return () => { alive = false; controller.abort(); clearInterval(timer); if (url) URL.revokeObjectURL(url); };
  }, [report.reportId]);
  return source
    ? <video className="event-video" src={source} controls autoPlay muted playsInline aria-label="실제 탐지 이벤트 영상" />
    : <p className="empty event-video-waiting" role="status">이벤트 영상 준비 중입니다.</p>;
}
