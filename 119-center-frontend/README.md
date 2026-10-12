# FIRIS 119 모의 접수센터 Frontend

FIRIS 메인 대시보드와 별도로 실행하는 React + Vite 기반 119 신고 접수센터 화면입니다.
기존 `119-center-frontend-v3`의 화면과 모의 출동 동작을 유지하고, 최신 `dev`의 신고 DTO 명칭에 맞춰 정리했습니다.

**현재는 프론트엔드 목업입니다.** 서버의 실제 신고를 수신하거나 FIRIS 알림을 변경하지 않습니다.
`backend/`, 기존 `frontend/`, `docker-compose.yml`은 이번 작업에서 수정하지 않았습니다.

## 실행

Node.js 20.19+ 또는 22.12+ 사용.

```powershell
cd 119-center-frontend
npm install
npm run dev
```

- 접속: http://localhost:5174
- 검사: `npm test`
- 빌드: `npm run build`
- 메인 FIRIS 프론트는 `5173`, 119-center 프론트는 `5174` 사용
- 독립 UI라 npm을 사용합니다. 메인 `frontend/`의 Yarn 설정은 변경하지 않습니다.
- `package-lock.json`은 기존 ZIP에서 비어 있던 버전 항목을 제거한 잠금 파일입니다. 로컬 `npm install`이 성공하면 현재 환경에 맞게 재생성된 잠금 파일을 PR에 포함하세요.

## 폴더 구조

```text
119-center-frontend/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx                    # 화면 전환, 신고 목록 상태
    ├── api/
    │   └── mock119Contract.js     # 최신 dev 백엔드 메시지/경로 규격 참고용
    ├── assets/styles/            # 공통/반응형 스타일
    ├── components/
    │   ├── Header/               # 헤더 및 탭
    │   ├── Modal/                # 공통 상세/영상 모달
    │   ├── ReportDetailModal/    # 신고 이력 상세 모달
    │   ├── StatusBadge/          # 접수센터 단계 표시
    │   ├── MockVideo/            # 시연용 CCTV 애니메이션
    │   ├── FacilityPlan/         # 시연용 시설 배치도
    │   └── ResponseMap/          # 시연용 모의 출동 지도
    ├── pages/
    │   ├── Reception/            # 접수 목록/상세 및 출동 처리
    │   └── History/              # 신고 이력/검색
    ├── data/
    │   └── mockReports.js        # 백엔드 필드명을 사용한 시연 데이터
    ├── hooks/
    │   └── useDemoReports.js     # 신고 선택/로컬 저장/시간 경과
    └── utils/
        ├── responseSimulation.js
        └── responseSimulation.test.js
```

## 반응형 레이아웃

- **1100px 이상, 화면 높이 700px 이상:** 화면 전체 스크롤 없이 신고 목록·CCTV·발생 위치·신고 정보·출동 경로·처리 버튼을 배치. 신고가 많거나 내용이 길면 해당 패널 내부만 스크롤.
- **601~1099px:** 신고 목록을 가로 카드로 전환하고 상세 화면을 넓게 사용. 화면 높이가 부족하면 세로 스크롤을 허용.
- **600px 이하:** 탐지 영상 → 위치 → 신고 정보 → 출동 경로 순으로 세로 배치하고 하단 처리 버튼은 스크롤 중에도 접근 가능.
- 확대 영상, 신고이력 상세 모달, 60초 자동 도착 등 동작은 기존과 동일.

## 현재 동작

- 신고 접수/신고 이력 전환, 최신 진행 중 신고 5건 조회
- 신고 상세(주소, 상세 위치, 신고자 이름·연락처, 특이사항, 탐지 유형·시간)
- CCTV 미리보기·배치도·모의 출동 경로 표시 (모두 시연 데이터)
- CCTV **영상 확대 보기**: 접수 화면의 확대 보기 버튼으로 큰 화면 모달 표시 (닫기/ESC/배경 클릭 지원)
- 신고 이력 **상세 보기**: 접수 화면 이동 없이 상세 모달에서 신고 정보·CCTV 미리보기·처리 기록 표시
- 사용자 화면의 개발용 안내 문구 제거 (README에는 미연동 범위를 계속 표기)
- 접수 완료 → 출동 → **1분(60초) 뒤 자동 도착** → 대응 완료
- 새로고침 시 상태와 출동 예정 시각을 브라우저 `localStorage`에 유지
- 출동 경로는 별도 지도 API 없이 정적 SVG 좌표로 표시하고, 경과 시간 비율에 따라 차량 아이콘을 이동시킴 (실제 거리·경로 및 도착 예측값이 아님)
- 출동 버튼을 누른 시점부터 60초를 계산하며, 화면을 닫았다가 다시 열어도 해당 브라우저의 저장된 출동 시간이 기준이 됨
- 대응 완료 후 FIRIS 알림 해제처럼 보이는 UI는 **목업 표시**이며 서버에는 반영되지 않음
- 로그인·JWT·실제 WebSocket·지도 서비스·DB 연동은 포함하지 않음

## 최신 FIRIS Backend와 맞춘 명칭

비교 기준: `GAMZADORII/FIRIS` `dev` 커밋 `1b4e209`.

현재 Backend가 전송하는 `Mock119Message.java`의 `FIRE_REPORT` 필드를
`src/data/mockReports.js`에서 같은 이름으로 사용합니다.

```json
{
  "type": "FIRE_REPORT",
  "requestId": "UUID 문자열",
  "eventId": 108,
  "cameraId": "CAM001",
  "siteAddress": "사업장 주소",
  "detailLocation": "현장 상세 위치",
  "specialNotes": "특이사항",
  "eventType": "FIRE",
  "detectedAt": "2026-10-08T14:32:08",
  "reporterLoginId": "worker01",
  "reporterName": "신고자 이름",
  "reporterPhone": "010-0000-0000",
  "controlRoomPhone": "02-000-0119"
}
```

실제 이벤트 유형은 `FIRE`, `SMOKE`, `FIRE_SMOKE` 등 Backend의 `EventType` 값을 따릅니다.

**용어 구분**

- `Mock119ReportStatus` (FIRIS Backend 신고 *전송 상태*): `PENDING`, `ACCEPTED`, `FAILED`
- `responseStatus` (119-center 화면 *모의 출동 상태*): `PENDING`, `DISPATCHED`, `ARRIVED`, `CLOSED`
- `reportId` (FIRIS 신고 DB 식별자)는 `Mock119ReportResponse`에만 있으며, 현재 `FIRE_REPORT` WebSocket 전송 메시지에는 없습니다. 이 목업의 `reportId`는 시연용 가상 값입니다.
- `facility`, `confidence`, `reportedAt`, `note`, `floor`, `zone`, `routePoints` 등은 화면 표현용 시연 필드입니다. 현재 `FIRE_REPORT` 메시지에 포함되지 않습니다.

기존 FIRIS Backend API는 다음과 같습니다. 모두 FIRIS 이벤트 기준이며, 접수센터용 전체 조회/대응 완료 API가 아닙니다.

| Method | Endpoint | 용도 |
| --- | --- | --- |
| GET | `/api/events/{eventId}/mock-119-preview` | 신고 미리보기 |
| POST | `/api/events/{eventId}/mock-119-reports` | 모의 신고 전송 |
| GET | `/api/events/{eventId}/mock-119-report` | 전송 상태 조회 |

Backend는 `Mock119WebSocketTransport`를 통해 **외부 WebSocket 서버에 연결하는 클라이언트**입니다.
`REPORT_ACK` 응답에는 동일한 `requestId`, `status: ACCEPTED`, 유효한 `receiptId`가 필요합니다.
현 프론트는 이 서버 역할을 수행하지 않습니다.

## 실제 연동 시 Backend 담당자와 협의할 부분

1. `FIRE_REPORT`를 받는 WebSocket 수신부와 접수센터 브라우저로의 새 신고 전달 경로
2. 접수센터 신고 전체 목록/상세 조회 API (현재 3개 엔드포인트만으로는 구현 불가)
3. 출동·도착·대응 완료 저장 방식과 FIRIS 미확인 알림 해제 이벤트/API
4. 인증/접근 제어 및 신고자 개인정보 노출 범위 (현재는 더미 정보만 사용)

실제 연동이 결정되면 `src/api/`에서 통신 로직을 추가하고, 현재 `useDemoReports` 상태를 실제 데이터로 교체하면 됩니다. 현재 자동 도착 처리는 브라우저에서만 일어나므로, 여러 접수자가 동일한 상태를 보거나 FIRIS의 신고 상태를 갱신하려면 Backend에 출동/도착/대응 완료 상태 저장 및 동기화 API가 필요합니다.
