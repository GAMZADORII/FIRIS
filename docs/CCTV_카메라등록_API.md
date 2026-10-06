# CCTV 카메라 등록 API

## 이번 변경
- 추가: backend/src/main/java/com/firis/camera/dto/CreateCameraRequest.java
- 수정: CameraController.java, CameraService.java, Camera.java, SecurityConfig.java, ErrorCode.java
- 추가 문서: docs/CCTV_카메라등록_API.md
- 기존 카메라 조회/JPEG 전달/AI/프론트 기능과 미커밋 변경은 유지합니다.
- 커밋, 푸시, 브랜치 생성은 수행하지 않습니다.

## 요청
POST /api/cameras
권한: ACTIVE ADMIN
Authorization: Bearer <accessToken>
Content-Type: application/json

```json
{
  "cameraId": "CAM004",
  "cameraName": "창고 CCTV",
  "location": "창고 A동",
  "streamUrl": "http://localhost:8080/videos/CAM004/001.mp4",
  "status": "ONLINE"
}
```

cameraId: 영문/숫자/밑줄/하이픈 1~30자. 기존 ID와 중복 불가.
cameraName: 필수, 공백만 불가, 최대 50자.
location: 선택(null 또는 생략 가능), 최대 100자.
streamUrl: 필수, 최대 500자, 호스트를 포함한 HTTP/HTTPS URL. 계정정보/fragment 불가. 파일 경로 및 file://, RTSP 주소는 받지 않습니다.
status: 필수, ONLINE 또는 OFFLINE. 저장한 상태일 뿐 실제 영상/AI 상태 자동 검사값이 아닙니다.

## 응답
201 Created, 요청에서 저장한 5개 필드를 CameraResponse로 반환합니다.

| HTTP | Code | 상황 |
|---|---|---|
| 400 | BAD_REQUEST | 누락/길이/형식/URL 오류 |
| 401 | UNAUTHORIZED | JWT 없거나 유효하지 않음 |
| 403 | FORBIDDEN | WORKER 등 ADMIN이 아닌 계정 |
| 403 | ACCOUNT_INACTIVE | 비활성 계정 |
| 403 | PASSWORD_CHANGE_REQUIRED | 기존 WORKER 초기 비밀번호 제한 |
| 409 | CAMERA_ALREADY_EXISTS | 중복 카메라 ID |
| 500 | INTERNAL_SERVER_ERROR | 예상하지 못한 서버/DB 오류 |

기존 ID를 덮어쓰지 않고 새 카메라만 INSERT합니다. 조회 GET /api/cameras는 기존 ADMIN/WORKER 권한입니다.

## 적용/확인
backend 폴더에서 다음 명령으로 빌드/실행합니다.

```powershell
.\gradlew.bat test bootJar
.\gradlew.bat bootRun
```

Postman에서 관리자 로그인 토큰으로 등록 후 GET /api/cameras에서 CAM004를 확인하세요.
같은 ID를 다시 보내면 409, WORKER 토큰으로 보내면 403이어야 합니다.
SQL 샘플은 더 이상 필수 등록 수단이 아니며 그대로 초기 시연용으로 사용할 수 있습니다.

## 범위
이 API는 기존 Camera 테이블에 정보와 URL만 저장합니다. 영상 업로드/파일 존재 확인/자동 AI 실행/프론트 등록 화면은 포함하지 않습니다.
001.mp4를 프로젝트 최상위 storage/videos/CAM004에 별도로 넣어야 위 예시 URL로 재생할 수 있습니다.
다른 PC에서 접속하면 localhost 대신 백엔드 PC 주소를 사용하세요.
