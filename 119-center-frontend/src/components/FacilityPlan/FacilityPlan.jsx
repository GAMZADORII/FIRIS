import { useState } from 'react';
const zones=[{id:'A',x:28,y:65},{id:'B',x:283,y:65},{id:'C',x:28,y:178},{id:'D',x:283,y:178}];
function Drawing({report}){
  const active=zones.find(z=>z.id===report.zone)||zones[0];
  return <svg viewBox="0 0 600 340" className="floor-drawing" role="img" aria-label={`${report.floor}층 ${report.zone}구역 발생 위치와 ${report.cameraId} CCTV 위치`}>
    <defs><pattern id="floor-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="#2a2d34" strokeWidth=".4"/></pattern></defs>
    <rect width="600" height="340" fill="#15161a"/><rect x="18" y="49" width="517" height="246" fill="url(#floor-grid)" stroke="#747780" strokeWidth="2"/>
    <text x="24" y="29" fill="#e3e2e6" fontSize="14">생산동 {report.floor}층</text><text x="530" y="29" fill="#80838d" fontSize="11">N ↑</text>
    {zones.map(z=><g key={z.id}><rect x={z.x} y={z.y} width="242" height="104" fill={z.id===report.zone?'#d32f2f30':'#26282e'} stroke={z.id===report.zone?'#ef646b':'#62656e'} strokeWidth={z.id===report.zone?2:1}/><text x={z.x+15} y={z.y+24} fontSize="13" fill={z.id===report.zone?'#ffb3ac':'#c4c7ca'}>{z.id}구역</text>{[0,1,2,3,4].map(i=><g key={i} fill={z.id===report.zone?'#7d4145':'#363941'} stroke="#747780" strokeWidth=".8"><rect x={z.x+16+i*42} y={z.y+40} width="24" height="20"/><rect x={z.x+16+i*42} y={z.y+71} width="24" height="20"/></g>)}</g>)}
    <path d="M18 173H535" stroke="#93969e" strokeWidth="2"/><rect x="537" y="136" width="40" height="54" fill="#ffb30012" stroke="#ffb300" strokeDasharray="4 3"/><text x="557" y="154" fill="#ffd799" textAnchor="middle" fontSize="10">동측</text><text x="557" y="169" fill="#ffd799" textAnchor="middle" fontSize="10">출입구</text><path d="M500 174H575" stroke="#ffb300" strokeWidth="2" strokeDasharray="5 4"/>
    <circle className="location-pulse" cx={active.x+152} cy={active.y+61} r="18" fill="#ef646b20"/><circle cx={active.x+152} cy={active.y+61} r="7" fill="#ff5964" stroke="#ffd4d5" strokeWidth="2"/><rect x={active.x+163} y={active.y+50} width="66" height="22" rx="3" fill="#9d292f"/><text x={active.x+196} y={active.y+65} fontSize="10" fill="#fff" textAnchor="middle">{report.cameraId}</text>
    <text x="35" y="322" fill="#92969f" fontSize="11">시설 배치도</text><circle cx="352" cy="318" r="4" fill="#ef646b"/><text x="362" y="322" fill="#c4c7ca" fontSize="10">발생 위치</text><path d="M460 318h17" stroke="#ffb300" strokeDasharray="3 2"/><text x="485" y="322" fill="#c4c7ca" fontSize="10">출입구</text>
  </svg>;
}
export default function FacilityPlan({report}){
  const [expanded,setExpanded]=useState(false);
  return <section className="media-card"><div className="card-heading"><h3>발생 위치 <span className="sub-badge">시설 배치도</span></h3><button className="small-button" onClick={()=>setExpanded(true)}>↗ 확대 보기</button></div><Drawing report={report}/><div className="media-footer"><span>{report.detailLocation} · {report.cameraId}</span><span className="danger-text">● 발생 구역</span></div>{expanded&&<dialog open className="plan-modal" aria-label="시설 배치도 확대" onKeyDown={e=>{if(e.key==='Escape')setExpanded(false);}}><div className="modal-head"><strong>{report.facility} · {report.floor}층 배치도</strong><button autoFocus onClick={()=>setExpanded(false)} aria-label="배치도 닫기">×</button></div><Drawing report={report}/><p>{report.detailLocation} · {report.cameraId}</p></dialog>}</section>;
}
