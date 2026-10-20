# FIRIS 119 모의 접수센터 Frontend

기존 Backend :8080에 연결하는 React/Vite 프론트다. 새 신고·대응 상태 변경은 `/ws/mock-119-center`에서 알림을 받고 실제 목록·영상·이력은 HTTP API로 조회한다. 더미 신고와 localStorage를 실제 데이터로 사용하지 않는다.

## 실행

Node.js 20.19+ 또는 22.12+ 사용. `.env.example`을 참고해 VITE_API_BASE_URL을 설정한다.

```powershell
npm ci
npm run dev
```

주소: http://localhost:5174. Backend는 통합 센터 설정을 켜고 기존 MySQL에 연결해 실행한다. 별도 119 Backend는 필요 없다. 로컬 개별 실행 또는 프로젝트 루트에서 docker compose up -d --build로 함께 실행한다. Docker 통합을 포함하며 Jenkins는 변경하지 않는다.

- `npm run build`: 빌드
- `npm test`: 서버 시각 표시 검사. 실제 서버 통합 검증은 Backend 테스트 참조.
- 초기 목록 조회, 새 신고·상태 변경 방송, 재연결 목록 복원, 30초 보완 조회
- 최신 진행 중 5건·최근 이력 5건, 상세·실제 이벤트 영상
- PENDING → 접수 완료 → DISPATCHED → 서버 기준 60초 뒤 ARRIVED → 대응 완료 → CLOSED
- 상태·시각·처리 이력은 서버 DB에 저장. 초기화 버튼 대신 서버 새로고침
- 기존 출동 지도 디자인은 유지한다. 발생 위치는 공장 A~E·창고 A~D의 9개 CCTV 구역 개념 배치도로 표시하며 실제 신고 cameraId로 강조한다. 지도와 고정 거리는 시연용 표현이고 실제 지리 정보가 아니다.
- 로그인·JWT·동의 문안 없는 격리된 시연용 센터. 실제 119 신고가 아니다

통신 코드: `src/api/client.js`, 상태: `src/hooks/useCenterReports.js`, 실제 영상: `src/components/EventVideo.jsx`.
더미 신고 데이터, 브라우저 상태 시뮬레이션, 가상 CCTV 영상 파일은 삭제했다.

API·환경변수·DB·권한·검증 범위는 [통합 문서](../docs/119_CENTER_INTEGRATION.md)를 따른다.
