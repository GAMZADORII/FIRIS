import { useEffect, useId, useState } from 'react';

export default function MockVideo({ report }) {
  const sceneId = useId().replaceAll(':', '');
  const ids = { wall: `${sceneId}-wall`, floor: `${sceneId}-floor`, glow: `${sceneId}-glow`, flame: `${sceneId}-flame` };
  const [playing, setPlaying] = useState(true), [elapsed, setElapsed] = useState(0);
  useEffect(() => { setElapsed(0); setPlaying(true); }, [report.reportId]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setElapsed(v => (v + 1) % 16), 1000);
    return () => clearInterval(timer);
  }, [playing]);
  return <div className="mock-video">
    <div className={`camera-scene ${playing ? 'playing' : 'paused'}`}>
      <svg viewBox="0 0 800 450" role="img" aria-label="공장 화재 탐지 상황을 표현한 CCTV 시뮬레이션">
        <defs><linearGradient id={ids.wall} x2="0" y2="1"><stop stopColor="#293747"/><stop offset="1" stopColor="#101d28"/></linearGradient><linearGradient id={ids.floor} x2="0" y2="1"><stop stopColor="#273c48"/><stop offset="1" stopColor="#0e1b25"/></linearGradient><radialGradient id={ids.glow}><stop stopColor="#ff813e" stopOpacity=".7"/><stop offset="1" stopColor="#ff813e" stopOpacity="0"/></radialGradient><linearGradient id={ids.flame} x2="0" y2="1"><stop stopColor="#ffc579"/><stop offset=".5" stopColor="#ff762f"/><stop offset="1" stopColor="#b73b1b"/></linearGradient></defs>
        <rect width="800" height="450" fill={`url(#${ids.wall})`}/>
        <path d="M0 300H800V450H0Z" fill={`url(#${ids.floor})`}/>
        <g stroke="#536576" strokeWidth="4" opacity=".5"><path d="M0 24H800M0 94H800M0 164H800M110 0V300M330 0V300M550 0V300M770 0V300"/><path d="M0 300L160 450M240 300L330 450M520 300L530 450M800 300L720 450"/></g>
        <g fill="#354b5d" stroke="#6d879a" strokeWidth="2"><rect x="65" y="124" width="118" height="177" rx="4"/><rect x="75" y="140" width="99" height="48" fill="#172c37"/><rect x="260" y="169" width="240" height="134" rx="6"/><rect x="282" y="126" width="196" height="57" rx="5"/><rect x="572" y="145" width="115" height="158" rx="5"/></g>
        <g fill="#91bac9" opacity=".7"><rect x="86" y="208" width="24" height="7"/><rect x="124" y="208" width="24" height="7"/><rect x="591" y="172" width="77" height="45" fill="#132833"/><circle cx="609" cy="238" r="5" fill="#64cca7"/></g>
        <path d="M20 357H735" stroke="#69747a" strokeWidth="16"/><path d="M20 357H735" stroke="#d29b48" strokeWidth="5" strokeDasharray="45 28"/>
        <g stroke="#69828f" strokeWidth="5"><path d="M210 278H530M210 309H530M228 277V337M512 277V337"/></g>
        <g fill="#3f5d68"><rect x="204" y="261" width="334" height="47" rx="4"/><rect x="213" y="262" width="315" height="14" fill="#90a0a1"/></g>
        <ellipse cx="442" cy="282" rx="133" ry="123" fill={`url(#${ids.glow})`} className="scene-glow"/>
        <g className="scene-smoke" fill="#869399" opacity=".34"><ellipse cx="455" cy="186" rx="33" ry="30"/><ellipse cx="437" cy="145" rx="42" ry="35"/><ellipse cx="462" cy="102" rx="58" ry="39"/><ellipse cx="482" cy="63" rx="71" ry="33"/></g>
        {report.eventType !== 'SMOKE' && <g className="scene-fire"><path d="M414 282c-17-39 21-52 16-87 32 18 19 47 32 46 5-13 4-19 9-26 26 30 43 67 5 82-28 12-51 5-62-15Z" fill={`url(#${ids.flame})`}/><path d="M438 282c-10-17 10-31 13-49 15 18 7 24 18 34 14 19-11 33-31 15Z" fill="#ffe4a1"/></g>}
        <g fill="none" stroke="#ff7554" strokeWidth="2.3"><rect x="398" y="172" width="100" height="144"/><path d="M399 175h12M399 175v12M497 175h-12M497 175v12M399 315h12M399 315v-12M497 315h-12M497 315v-12" strokeWidth="5"/></g>
        <rect x="398" y="149" width="136" height="23" rx="2" fill="#ec613f"/><text x="405" y="165" fill="#fff" fontFamily="monospace" fontSize="13">{report.eventType === 'SMOKE' ? 'SMOKE' : 'FIRE'} {report.confidence}%</text>
      </svg>
      <div className="scene-top"><span><i/> {report.cameraId} · {report.detailLocation}</span><span>REC</span></div>
      <div className="scene-bottom"><span>{report.reportedAt?.replace('T', ' ')}</span></div>
    </div>
    <div className="video-controls"><button aria-label={playing ? '미리보기 일시정지' : '미리보기 재생'} onClick={() => setPlaying(v => !v)}>{playing ? 'Ⅱ' : '▶'}</button><span>00:{String(elapsed).padStart(2,'0')} / 00:15</span><div className="video-track"><i style={{ width:`${elapsed/15*100}%` }}/></div></div>
  </div>;
}
