# dev 브랜치 Docker 로컬 실행

저장소 루트의 `.env`를 Compose가 읽는다. 이번 로컬 설정에는 랜덤 JWT/API/DB 키를 준비했다. 실제 값은 Git에서 제외한다.

```bash
cd ~/FIRIS
sudo docker compose up -d --build --remove-orphans --wait
sudo docker compose ps
```

Frontend: http://localhost:5173/login
119 모의 접수센터: http://localhost:5174
Backend health: http://localhost:8080/api/health
AI health: http://localhost:8000/health

초기 관리자 로그인은 루트 `.env`의 ADMIN_LOGIN_ID와 ADMIN_PASSWORD를 사용한다. 기존 DB에 관리자가 있으면 초기 비밀번호 설정은 기존 계정을 변경하지 않는다.

`main`에서 생성한 이미지도 `--build`로 dev 소스로 다시 빌드하며 `--remove-orphans`로 이전 Compose 서비스 컨테이너를 정리한다. 볼륨은 삭제하지 않는다. 기존 main의 AI named volume은 남아 있으나 dev는 ai/model과 storage의 호스트 파일을 사용한다.

AI 모델과 시연 영상은 Git LFS 실제 파일이 필요하다. `git lfs pull`로 내려받는다. Docker 컨테이너는 이미지 내부 소스로 실행하므로 코드 수정 후에는 다시 빌드한다.

```bash
sudo docker compose logs --tail=100 backend frontend ai-worker
sudo docker compose down
```

`down -v`는 MySQL 데이터까지 삭제하므로 사용하지 않는다.

관제실 번호는 DB의 공통 설정 테이블이 아니라 루트 `.env`의 `MOCK_119_CONTROL_ROOM_PHONE`에서 읽는다. 기본값은 `041-123-4567`이며 환경변수로 변경할 수 있다. Backend 컨테이너를 재생성하면 신고 preview에 표시되고 새 신고 레코드에 번호가 저장된다. 이미 제출한 신고는 당시 번호를 보존한다.

## 최고 관리자

권한은 SUPER_ADMIN > ADMIN이며 최고 관리자는 기존 관리자 메뉴와 API를 사용할 수 있다. Backend 시작 시 `superadmin1`(박상현), `superadmin2`(차나래)가 없으면 자동 등록하며 기본 비밀번호는 `1234`이다. 비밀번호는 BCrypt 해시로 저장한다. 두 계정 중 하나만 없어도 누락된 계정만 생성한다. 기존 계정의 비밀번호·이름·비활성화 상태는 유지한다.

`SUPER_ADMIN_ENABLED=false`로 자동 생성을 끌 수 있고, `SUPER_ADMIN_PASSWORD`로 새로 생성할 계정의 초기 비밀번호를 변경할 수 있다. 이미 있는 계정의 비밀번호는 이 설정으로 바뀌지 않는다. 동일 ID가 다른 권한에 사용 중이면 기존 권한을 바꾸지 않고 시작 시 오류로 알린다. 기존 `.env`에 새 설정이 없어도 기본값으로 작동한다.

기본 `DDL_AUTO=update`에서는 SUPER_ADMIN 역할을 포함한 스키마를 자동 반영한다. 스키마를 수동 관리하면 [역할 확장 SQL](sql/001-super-admin-role.sql)을 먼저 적용한다. [기존 수동 계정 등록 SQL](sql/002-seed-local-super-admins.sql)은 선택 사항이며 일반 실행에는 필요 없다.

### 데이터별 초기화

| 항목 | 서버 시작 시 동작 |
| --- | --- |
| 최고 관리자 두 명 | 누락된 login_id만 생성 |
| 기본 관리자 | ADMIN_PASSWORD가 설정되어 있고 ADMIN 계정이 없을 때 생성 |
| 기본 CCTV CAM001~CAM009 | 없는 ID만 생성하며 논리 삭제된 CCTV는 복원하지 않음 |
| 작업자·이벤트·검수·신고 | 운영 기능을 통해 생성, 예시 기록 자동 추가 안 함 |
| 관제실 번호 | 서버 설정 기본값 041-123-4567 사용, 새 신고에 당시 값 저장 |
| 사업장 주소 | 실제 주소를 환경변수로 설정, 임의 주소 자동 등록 안 함 |

기본 데이터는 Backend 초기화 코드에서 등록하므로 새 DB뿐 아니라 기존 DB에서도 누락된 항목을 보충한다. 팀원마다 SQL을 수동 실행할 필요가 없다.

## CCTV 추가·삭제 반영

Backend와 Frontend를 함께 재빌드한다. 기본 `DDL_AUTO=update`에서는 CAMERA.deleted 열을 기존 행의 FALSE 기본값과 함께 추가한다. 스키마를 수동 관리하는 환경은 [열 추가 SQL](sql/003-camera-soft-delete.sql)을 먼저 적용한다. 삭제해도 DB의 기존 이벤트와 영상 파일은 남으며 삭제한 CCTV ID는 재사용하지 않는다. CCTV 등록이 영상 파일을 업로드하거나 AI worker를 재설정하지는 않는다. 현재 AI worker의 최대 9개 입력 폴더 제한은 유지한다.
