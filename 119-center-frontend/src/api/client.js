const configured = import.meta.env.VITE_API_BASE_URL;
export const API_BASE = (configured || `${window.location.protocol}//${window.location.hostname}:8080`).replace(/\/$/, '');

export async function request(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options, headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.message || `서버 요청에 실패했습니다. (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// Korea-local DTO dates have no offset. Interpret them consistently on every browser.
export const epoch = value => value ? Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}+09:00`) : null;

export function normalizeReport(r) {
  const labels = { PENDING: '신규 신고', DISPATCHED: '출동 중', ARRIVED: '현장 도착', CLOSED: '대응 완료' };
  return { ...r,
    facility: r.siteAddress || '사업장',
    confidence: Number((r.confidence * 100).toFixed(1)),
    accidentType: { FIRE: '화재', SMOKE: '연기', FIRE_SMOKE: '화재·연기' }[r.eventType] || r.eventType,
    note: r.specialNotes || '특이사항 없음',
    dispatchAt: epoch(r.dispatchAt), arrivalAt: epoch(r.arrivalAt),
    history: r.history.map(h => ({ status: h.status, label: labels[h.status],
      time: h.occurredAt.replace('T', ' '), actor: h.status === 'ARRIVED' ? '자동 도착' : '119 모의 접수센터' })),
  };
}

export function connectCenter(onChange, onConnection = () => {}) {
  let socket, timer, heartbeat, disposed = false, retry = 1000, lastPong = 0;
  function open() {
    const url = new URL(API_BASE + '/ws/mock-119-center');
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(url);
    socket.onopen = () => {
      retry = 1000; lastPong = Date.now(); onConnection(true); onChange();
      heartbeat = setInterval(() => {
        if (Date.now() - lastPong > 45000) socket.close();
        else if (socket.readyState === WebSocket.OPEN) socket.send('PING');
      }, 15000);
    };
    socket.onmessage = ({ data }) => {
      if (data === 'PONG') { lastPong = Date.now(); return; }
      try { const e = JSON.parse(data); if (['REPORT_CREATED', 'REPORT_UPDATED'].includes(e.type)) onChange(e); }
      catch { /* Recover from the authoritative HTTP snapshot. */ }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      clearInterval(heartbeat); onConnection(false);
      if (!disposed) { timer = setTimeout(open, retry); retry = Math.min(retry * 2, 10000); }
    };
  }
  open();
  return () => { disposed = true; clearTimeout(timer); clearInterval(heartbeat); socket.close(); };
}
