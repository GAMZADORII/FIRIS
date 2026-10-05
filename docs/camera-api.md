# 로컬 CCTV MP4 재생

## 구성

backend/storage/videos의 MP4를 Spring의 정적 파일 처리기로 제공합니다.
Camera.streamUrl에는 http://localhost:8080/videos/camera01.mp4 같은 HTTP 주소를 저장합니다.
GET /api/cameras로 URL을 받은 프론트가 video 요소로 재생합니다.
파일을 재인코딩하거나 YOLO를 실행하지 않습니다. Firebase 계정/SDK/결제 설정이 필요하지 않습니다.

## 실행 순서

1. ZIP을 풀고 backend 폴더에서 실행합니다. storage/videos에 영상 3개가 포함돼 있습니다.
2. .env.example을 참고해 .env 또는 환경변수로 DB_URL, DB_USERNAME, DB_PASSWORD, JWT_SECRET, ADMIN_LOGIN_ID, ADMIN_PASSWORD를 설정합니다. JWT_SECRET은 최소 32바이트입니다.
3. MySQL을 실행하고 아래 명령으로 백엔드를 시작합니다. 기본 포트는 8080입니다.

```powershell
.\gradlew.bat bootRun
```

4. 스키마가 준비되면 앱과 동일한 MySQL DB에서 docs/camera-sample.sql을 수동 실행합니다. CAM001~003이 이미 존재하면 stream_url만 수정합니다. 실행 전 기존 ID가 원하는 시연 카메라인지 확인하세요.
5. 브라우저에서 http://localhost:8080/videos/camera02.mp4 를 열어 재생을 확인합니다.
6. 기존 로그인 API로 로그인하고 GET /api/cameras를 호출합니다.

DB 컬럼에는 Windows 파일 경로나 file:// 주소를 넣지 않습니다.
이번 작업은 사용자 DB에 접속하거나 기존 Firebase URL을 자동 변경하지 않았으므로 SQL 적용이 필요합니다.

## 포함 영상

| 파일 | 데이터셋 라벨 | 길이 | 용량 |
|---|---|---|---|
| camera01.mp4 | FWW / NONE (정상) | 12초 | 7.89MB |
| camera02.mp4 | FWW / FL (불꽃) | 12초 | 19.53MB |
| camera03.mp4 | FWW / SM (연기) | 12초 | 21.88MB |

사용자가 제공한 AI Hub Sample.zip의 연속 JPG를 재구성한 1080p/30FPS/H.264 MP4이며 원본 MP4는 아닙니다. 바운딩박스/음성은 없습니다. NONE 영상에도 소방 활동이 보입니다. FWW는 공장/창고/작업장 통합 분류입니다.

## 저장 폴더 설정

기본값은 실행 작업 디렉터리 기준 ./storage/videos입니다.
다른 폴더를 쓰려면 CAMERA_VIDEO_DIRECTORY를 설정합니다. Windows .env에서는 C:/FIRIS/videos처럼 슬래시 경로를 권장합니다.
폴더 바로 아래의 .mp4 파일만 재생 대상으로 사용합니다.
영상은 JAR 안에 포함되지 않으므로 JAR 실행 시에도 해당 폴더를 함께 보관하세요.

```powershell
$env:CAMERA_VIDEO_DIRECTORY = 'C:/FIRIS/videos'
.\gradlew.bat bootRun
```

같은 PC에서는 localhost를 사용합니다. 다른 PC에서 접속할 때 localhost는 그 PC 자체를 의미하므로 DB URL을 백엔드 PC의 실제 IP 또는 호스트명으로 변경해야 합니다. 프론트 API 주소와 방화벽/CORS 설정도 배포 환경에 맞게 확인하세요.

## 카메라 목록 API

- Method / Endpoint: GET /api/cameras
- 권한: ACTIVE ADMIN / WORKER, WORKER는 최초 비밀번호 변경 완료 필요
- Request: Body와 Query 없음, Authorization: Bearer <accessToken>
- Response: 200, cameraId 오름차순 JSON 배열, 등록이 없으면 []

```json
[
  {
    "cameraId": "CAM001",
    "cameraName": "FWW 정상 라벨 시연",
    "location": "공장/창고/작업장 분류 샘플",
    "streamUrl": "http://localhost:8080/videos/camera01.mp4",
    "status": "ONLINE"
  }
]
```

| HTTP | 코드 | 상황 |
|---|---|---|
| 401 | UNAUTHORIZED | 토큰 누락/잘못된 토큰/만료/계정 없음 |
| 403 | ACCOUNT_INACTIVE | 비활성 계정 |
| 403 | PASSWORD_CHANGE_REQUIRED | WORKER 초기 비밀번호 미변경 |
| 403 | FORBIDDEN | 권한 없음 |
| 500 | INTERNAL_SERVER_ERROR | 서버/DB 오류 |

location/streamUrl은 기존 nullable 설정을 유지하며 OFFLINE 카메라도 포함합니다.
status는 DB에 저장된 값이며 파일 존재 여부를 자동 검사하지 않습니다.

## 로컬 영상 제공

- GET /videos/{파일명}.mp4: 200 video/mp4, 파일이 없으면 404 RESOURCE_NOT_FOUND
- Range 헤더로 구간 요청 시: 206 Partial Content, 잘못된 범위는 416
- HEAD /videos/{파일명}.mp4: 파일 헤더만 반환
- Request Body 없음, video 요소로 바로 재생 가능

이 경로는 로컬 시연용으로 인증 없이 GET/HEAD를 허용합니다. 일반 video src 요청에는 기존 API의 Bearer 헤더를 직접 붙일 수 없기 때문입니다. 접근 가능한 호스트에서는 주소를 아는 사람이 재생할 수 있으므로 시연용 MP4만 이 폴더에 두세요. 목록 API는 기존 JWT 인증을 유지합니다. 민감한 실사용 CCTV의 접근 제어는 별도 구현이 필요합니다.

## 프론트 연동 예시

프론트 변경은 이번 범위에 포함하지 않았습니다. API 응답에 포함된 절대 HTTP 주소를 그대로 사용하면 됩니다.

```jsx
<video src={camera.streamUrl} autoPlay muted loop playsInline controls />
```

Firebase 전송량은 발생하지 않습니다. 반복 재생 시 로컬 서버와 브라우저 사이의 전송/캐시가 작동합니다. 외부 PC에서 접속하면 그 PC와 서버 사이의 네트워크는 사용합니다.
시연 MP4 응답에는 1시간 캐시 허용 헤더를 설정했습니다. 브라우저가 항상 전체 영상을 보관하는 것은 아닙니다. 같은 이름의 파일을 교체하면 캐시가 남을 수 있으므로 새 파일명과 DB URL을 사용하는 것을 권장합니다.

## 기존 AI 박스 이미지와의 관계

최신 FIRIS-dev (1).zip의 CameraFrameController 및 AI 코드는 유지했습니다.
원본 MP4 재생과 AI 박스 표시는 별도 경로입니다.

- 원본: GET /api/cameras의 streamUrl을 video 요소로 재생합니다.
- 박스 화면: GET /api/cameras/{cameraId}/frame으로 AI가 이미 박스를 그린 최신 JPEG를 받습니다. ACTIVE ADMIN/WORKER JWT가 필요합니다.
- 프론트는 JPEG를 주기적으로 요청해 화면의 사진을 교체해야 합니다. MP4 위에 좌표를 겹치는 구현이 아닙니다. 프론트 연동은 아직 없습니다.
- 일반 img src에는 Bearer 헤더를 설정할 수 없으므로 인증된 요청으로 이미지를 받아 Blob URL 등으로 표시해야 합니다.

AI 실행 전 실제 yolo.pt 모델 가중치와 AI 의존성이 필요합니다. ZIP의 모델 파일은 Git LFS 포인터여서 그대로 추론할 수 없습니다.
Backend의 AI_SERVER_URL, AI와 Backend의 동일한 AI_API_KEY, AI의 BACKEND_URL을 설정하세요. 두 AI 프로세스는 같은 LIVE_FRAME_DIR을 사용해야 합니다.
카메라 SQL을 먼저 적용한 뒤 ai 폴더의 별도 터미널에서 각각 실행합니다.

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
python -m app.services.video_service --source ../backend/storage/videos/camera02.mp4 --camera-id CAM002 --model yolo --realtime
```

현재 AI 파일 분석은 영상 끝에서 종료하며 자동 반복하지 않습니다. 최신 JPEG는 5초 이상 오래되면 제공되지 않습니다. 프론트 video의 loop와 AI 파일 분석 반복은 별개입니다.
AI 이벤트의 snapshot/video 경로는 AI 파일시스템 경로이며, 이번 /videos 경로로 이벤트 파일까지 자동 공개하지 않습니다.

## 변경 파일 (최신 dev ZIP 대비)

- src/main/java/com/firis/camera/config/LocalVideoConfig.java 추가
- src/main/java/com/firis/common/SecurityConfig.java: 로컬 MP4 GET/HEAD 허용
- src/main/java/com/firis/common/exception/ErrorCode.java, GlobalExceptionHandler.java: 누락 정적 파일을 500 대신 404 RESOURCE_NOT_FOUND로 응답
- src/main/resources/application.yml, .env.example: 영상 디렉터리 설정
- src/main/java/com/firis/camera/controller/CameraController.java 추가
- src/main/java/com/firis/camera/service/CameraService.java 추가
- src/main/java/com/firis/camera/dto/CameraResponse.java 추가
- src/main/java/com/firis/camera/entity/Camera.java: 응답에 필요한 getter 보완
- src/test/java/com/firis/camera/CameraApiTest.java 추가
- src/test/java/com/firis/camera/CameraFrameCompatibilityTest.java 추가
- src/test/java/com/firis/camera/LocalVideoApiTest.java 추가
- docs/camera-api.md, docs/camera-sample.sql: 로컬 재생 안내/등록 SQL로 교체
- storage/videos/camera01.mp4, camera02.mp4, camera03.mp4 추가

기존 CameraRepository, CameraFrameController 및 AI/프론트 코드는 유지했습니다.
기존 설정의 고정 기본 JWT Secret과 계정 비밀번호는 실행 환경변수로 덮어써야 합니다.

## 검증 명령

```powershell
.\gradlew.bat test bootJar
```

CameraApiTest는 실제 JWT 및 SecurityConfig, Controller/Service와 대체 Repository를 사용합니다.
LocalVideoApiTest는 실제 ResourceHandler의 MP4 응답, 구간 요청, HEAD, 누락 파일 및 경로 접근 차단을 확인합니다.
전용 MySQL 환경변수가 필요한 기존 테스트는 해당 설정이 없으면 건너뜁니다. 실제 MySQL과 브라우저 통합 확인은 실행 환경에서 수행하세요.

이번 수정본 검증 결과: Java 17에서 test/bootJar 성공. 카메라 API 4개, 로컬 파일 제공 4개, JPEG 프록시 호환 3개, 기존 서비스 3개 등 14개 통과. 전용 MySQL이 필요한 기존 테스트 8개는 건너뛰었습니다. AI 시간 판정/Backend client 테스트 10개 통과. JPEG 호환 테스트는 로컬 대체 HTTP 서버를 사용했으며 실제 YOLO 추론 검증이 아닙니다. 포함된 3개 MP4는 생성 단계에서 전체 디코딩 검증을 통과했습니다. 실제 MySQL 접속과 프론트/브라우저 재생은 아직 검증하지 않았습니다.
