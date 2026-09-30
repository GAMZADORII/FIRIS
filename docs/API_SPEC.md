# API 명세

## 현재 구현 API
| 서비스 | Method | 경로 | 성공 응답 | 인증 |
| --- | --- | --- | --- | --- |
| AI (localhost:8000) | GET | /health | 200, `{"status":"ok"}` | 없음 |
| Backend (localhost:8080) | GET | /api/health | 200, `{"status":"ok"}` | 없음 |

두 API는 프로세스 응답 확인용이며 DB/모델/외부 시스템의 준비 상태를 검사하지 않는다.
응답 Content-Type은 application/json이다.

```bash
curl http://localhost:8000/health
curl http://localhost:8080/api/health
```

## 향후 예정 API — 현재 미구현
| Method | 경로 | 책임 |
| --- | --- | --- |
| POST | /api/ai/events | AI 위험 확정 시 FIRE_EVENT를 즉시 생성하고 eventId 반환 |
| PATCH | /api/ai/events/{eventId}/media | 동일 eventId에 생성 완료된 영상 등의 미디어 경로 업데이트 |

AI는 POST 응답의 eventId를 보관한다. Backend는 mp4 생성 완료를 기다리지 않는다.
PATCH는 이벤트 이후 프레임 수집 및 영상 파일 저장이 끝나면 호출한다.
DB에는 파일 경로만 저장한다. 이 명세는 Binary 업로드를 정의하지 않는다.
요청 필드, eventId 타입, 성공 상태 코드, 오류 형식, AI_API_KEY 검증,
Snapshot 전달 시점, 재시도·중복 이벤트 방지·미디어 실패 처리는 구현 전에 확정한다.
JWT_SECRET 및 AI_API_KEY는 환경 예제에만 예약되어 있고 현재 사용하지 않는다.

계정 인증, 작업자 관리, CCTV 조회, 이벤트 검색/상세, 검수, 통계 API는
REQUIREMENTS를 기준으로 추후 문서에서 먼저 정의한다. 아직 엔드포인트를 만들지 않는다.
