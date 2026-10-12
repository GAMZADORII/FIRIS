import { useId, useState } from 'react';
import Modal from '../Modal/Modal.jsx';
import { cameraChannelSlots, cameraDisplayName } from '../../utils/cameraChannels.js';

function Drawing({ report }) {
  const patternId = useId().replaceAll(':', '');
  const smoke = report.eventType === 'SMOKE';
  const accent = smoke ? '#ffb300' : '#ef646b';
  const active = cameraChannelSlots.find(([id]) => id === report.cameraId);
  return <svg viewBox="0 0 600 340" className="floor-drawing" role="img" aria-label={`공장 A부터 E구역, 창고 A부터 D구역 CCTV 배치. 발생 위치: ${active?.[1] || '구역 미등록'}`}>
    <defs><pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="#2a2d34" strokeWidth=".4" /></pattern></defs>
    <rect width="600" height="340" fill="#15161a" />
    <text x="24" y="25" fill="#e3e2e6" fontSize="13">공장 · 창고 CCTV 구역</text>
    <text x="565" y="25" fill="#80838d" fontSize="10" textAnchor="end">구역 배치도</text>
    <rect x="18" y="39" width="564" height="246" fill={`url(#${patternId})`} stroke="#747780" strokeWidth="2" />
    <text x="28" y="57" fill="#c4c7ca" fontSize="11">공장</text>
    <text x="28" y="181" fill="#c4c7ca" fontSize="11">창고</text>
    <path d="M18 161H582" stroke="#747780" strokeWidth="2" />
    {cameraChannelSlots.map(([id, location], index) => {
      const factory = index < 5;
      const width = factory ? 100 : 127;
      const x = 28 + (factory ? index : index - 5) * (width + 9);
      const y = factory ? 66 : 190;
      const selected = id === report.cameraId;
      return <g key={id}>
        <rect x={x} y={y} width={width} height="84" fill={selected ? (smoke ? '#ffb30020' : '#d32f2f30') : '#26282e'} stroke={selected ? accent : '#62656e'} strokeWidth={selected ? 2 : 1} />
        <text x={x+9} y={y+17} fill={selected ? accent : '#c4c7ca'} fontSize="11">{location}</text>
        {[0,1,2].map(i => <g key={i} fill={selected ? (smoke ? '#79602b' : '#7d4145') : '#363941'} stroke="#747780" strokeWidth=".8"><rect x={x+10+i*25} y={y+30} width="16" height="13" /><rect x={x+10+i*25} y={y+50} width="16" height="13" /></g>)}
        <text x={x+9} y={y+76} fill={selected ? '#fff' : '#93969f'} fontSize="9">{cameraDisplayName(id)}</text>
        {selected && <g><circle className="location-pulse" cx={x+width-17} cy={y+46} r="13" fill={smoke ? '#ffb30030' : '#ef646b30'} /><circle cx={x+width-17} cy={y+46} r="5" fill={accent} stroke="#fff" strokeWidth="1.5" /></g>}
      </g>;
    })}
    <text x="28" y="310" fill="#93969f" fontSize="10">공장 5구역 · 창고 4구역</text>
    <circle cx="385" cy="306" r="4" fill={accent} /><text x="395" y="310" fill="#c4c7ca" fontSize="10">발생 CCTV 구역</text>
    <text x="28" y="328" fill="#737680" fontSize="9">CCTV 구역 기준 개념 배치도</text>
  </svg>;
}

export default function FacilityPlan({ report }) {
  const [expanded, setExpanded] = useState(false);
  const location = cameraChannelSlots.find(([id]) => id === report.cameraId)?.[1];
  return <section className="media-card">
    <div className="card-heading"><h3>발생 위치 <span className="sub-badge">시설 배치도</span></h3><button className="small-button" onClick={() => setExpanded(true)}>↗ 확대 보기</button></div>
    <Drawing report={report} />
    <div className="media-footer"><span>{location || report.detailLocation} · {cameraDisplayName(report.cameraId)}</span><span className="danger-text">● {location ? '발생 구역' : '구역 미등록'}</span></div>
    <Modal open={expanded} onClose={() => setExpanded(false)} title="공장·창고 CCTV 구역 배치도" className="plan-detail-modal">
      {expanded && <Drawing report={report} />}<p>{report.detailLocation} · {report.cameraId}</p>
    </Modal>
  </section>;
}
