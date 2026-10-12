export function initialReports() {
  const samples = [
    ['20261008-008', 'PENDING', '한빛산업 제1공장', '1층 생산라인 A', '서울시 성동구 모의산업로 119', 'FIRE_SMOKE', 98.2, '14:32:08', '생산라인 설비 주변에서 불꽃과 연기를 확인했습니다. 작업자는 대피 중입니다.', '김관제', 'CAM001'],
    ['20261008-007', 'PENDING', '새봄정밀 제2공장', 'B동 자재 가공실', '경기도 안산시 모의공단로 24', 'FIRE', 95.7, '14:28:42', '가공 설비 하단에서 불꽃이 관찰됩니다. 인근 설비의 전원 차단을 요청했습니다.', '이관제', 'CAM004'],
    ['20261008-006', 'DISPATCHED', '한빛산업 제1공장', '2층 조립라인', '서울시 성동구 모의산업로 119', 'SMOKE', 92.4, '14:19:21', '조립라인에서 지속적인 연기를 확인했습니다. 현장 확인이 필요합니다.', '김관제', 'CAM002'],
    ['20261008-005', 'PENDING', '동우테크 생산동', '전기 제어실', '인천시 남동구 모의산업길 82', 'FIRE', 96.1, '14:12:05', '제어반 부근에 작은 불꽃이 보여 신고합니다. 현장 담당자와 연락 중입니다.', '박관제', 'CAM003'],
    ['20261008-004', 'ARRIVED', '새봄정밀 제2공장', '1층 용접 작업구역', '경기도 안산시 모의공단로 24', 'FIRE_SMOKE', 97.6, '13:58:33', '용접 작업구역 주변 자재에서 불꽃이 확인되었습니다.', '이관제', 'CAM004'],
    ['20261008-003', 'CLOSED', '동우테크 생산동', '부품 검사실', '인천시 남동구 모의산업길 82', 'SMOKE', 91.5, '13:20:10', '검사 장비에서 연기가 발생했습니다. 현장 조치 후 상황이 종료되었습니다.', '박관제', 'CAM003'],
    ['20261008-002', 'CLOSED', '한빛산업 제1공장', '1층 생산라인 B', '서울시 성동구 모의산업로 119', 'FIRE', 94.8, '11:42:17', '설비 주변 화재 확인 후 현장 조치가 완료되었습니다.', '김관제', 'CAM001'],
    ['20261008-001', 'CLOSED', '새봄정밀 제2공장', '설비 점검구역', '경기도 안산시 모의공단로 24', 'SMOKE', 90.3, '09:15:30', '설비 점검 중 연기를 확인했습니다. 안전 점검 후 종료했습니다.', '이관제', 'CAM004'],
  ];
  return samples.map(([id,status,facility,location,address,type,confidence,time,note,reporter,cameraId], index) => {
    const reportedAt = `2026-10-08T${time}`;
    const statusStages = [['RECEIVED', '접수'], ['DISPATCHED', '출동'], ['ARRIVED', '도착'], ['CLOSED', '대응 완료']];
    const stage = statusStages.findIndex(([key]) => key === status);
    const history = statusStages.slice(0, stage + 1).map(([key,label], n) => ({ status:key, label, time:new Date(new Date(reportedAt).getTime() + n*120000).toLocaleTimeString('ko-KR',{hour12:false}), actor:'119 접수센터' }));
    return {
      // Backend Mock119Message wire fields (dev):
      type: 'FIRE_REPORT', requestId: `00000000-0000-4000-8000-${String(100000000000 + index)}`,
      eventId: 108 - index, cameraId, siteAddress: address, detailLocation: location,
      specialNotes: '현장 출입 시 안전 확인 필요', eventType: type,
      detectedAt: reportedAt, reporterLoginId: `demo${index + 1}`, reporterName: reporter,
      reporterPhone: '010-0000-0000', controlRoomPhone: '02-000-0119',
      // Center-only mock fields: NOT provided by the current WebSocket payload.
      reportId: 108 - index, responseStatus: status, facility,
      confidence, reportedAt, note, history,
    };
  });
}


