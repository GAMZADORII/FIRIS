const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
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
