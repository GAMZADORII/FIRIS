import { initialReports } from '../data/mockReports.js';
export const responseStatusLabels = {
  PENDING: '신규 신고', DISPATCHED: '출동 중', ARRIVED: '현장 도착', CLOSED: '대응 완료',
};
export const responseSteps = [['RECEIVED', '접수'], ['DISPATCHED', '출동'], ['ARRIVED', '도착'], ['CLOSED', '대응 완료']];

export const STORAGE_KEY = '119-center-mock-v4';
export const ARRIVAL_DELAY_MS = 60_000;
export const isFirisUnconfirmed = report => report.responseStatus !== 'CLOSED';
const timestamp = ms => new Date(ms).toLocaleTimeString('ko-KR', { timeZone:'Asia/Seoul', hour12:false });
export function makeDemoReports(now=Date.now()) {
  return initialReports().map((r,i) => {
    const distanceKm=Number((1.6+i*.7).toFixed(1));
    const cameraZone={CAM001:{floor:1,zone:'A'},CAM002:{floor:2,zone:'B'},CAM003:{floor:1,zone:'C'},CAM004:{floor:2,zone:'D'}}[r.cameraId]||{floor:1,zone:'A'};
    return {...r,accidentType:{FIRE:'화재',SMOKE:'연기',FIRE_SMOKE:'화재·연기'}[r.eventType] || r.eventType,detectedAt:r.reportedAt,specialNotes:r.cameraId==='CAM001'?'리튬배터리 보관구역':'현장 출입 시 안전 확인 필요',floor:cameraZone.floor,zone:cameraZone.zone,distanceKm,
      routePoints:[[55,185],[165,185],[165,100],[365,100],[365,55],[565,55]],
      dispatchAt:r.responseStatus==='DISPATCHED'?now:null,arrivalAt:r.responseStatus==='DISPATCHED'?now+ARRIVAL_DELAY_MS:null};
  });
}
export function transitionReport(r,target,now=Date.now()) {
  if ({PENDING:'DISPATCHED',ARRIVED:'CLOSED'}[r.responseStatus]!==target) return r;
  return {...r,...(target==='DISPATCHED'?{dispatchAt:now,arrivalAt:now+ARRIVAL_DELAY_MS}:{}),responseStatus:target,
    history:[...r.history,...(target==='DISPATCHED'?[{status:'RECEIVED',label:'접수 완료',time:timestamp(now),actor:'119 접수센터'}]:[]),{status:target,label:responseSteps.find(([k])=>k===target)[1],time:timestamp(now),actor:'119 접수센터'}]};
}
export function updateDueArrivals(rows,now=Date.now()) {
  let changed=false;
  const next=rows.map(r=>{
    if(r.responseStatus!=='DISPATCHED'||!Number.isFinite(r.arrivalAt)||now<r.arrivalAt)return r;
    changed=true;
    return {...r,responseStatus:'ARRIVED',history:[...r.history,{status:'ARRIVED',label:'도착',time:timestamp(r.arrivalAt),actor:'자동 도착'}]};
  });
  return changed?next:rows;
}
export const remainingSeconds=(r,now)=>r.responseStatus==='DISPATCHED'&&Number.isFinite(r.arrivalAt)?Math.max(0,Math.ceil((r.arrivalAt-now)/1000)):0;
export function routeProgress(r,now){
  if(['ARRIVED','CLOSED'].includes(r.responseStatus))return 1;
  if(r.responseStatus!=='DISPATCHED'||!Number.isFinite(r.dispatchAt)||!Number.isFinite(r.arrivalAt))return 0;
  return Math.min(1,Math.max(0,(now-r.dispatchAt)/(r.arrivalAt-r.dispatchAt)));
}
export function positionAlongRoute(points,progress){
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  let remaining=lengths.reduce((a,b)=>a+b,0)*Math.min(1,Math.max(0,progress));
  for(let i=0;i<lengths.length;i++){
    if(remaining<=lengths[i]){const ratio=lengths[i]?remaining/lengths[i]:0;return [points[i][0]+(points[i+1][0]-points[i][0])*ratio,points[i][1]+(points[i+1][1]-points[i][1])*ratio];}
    remaining-=lengths[i];
  }return points.at(-1);
}



