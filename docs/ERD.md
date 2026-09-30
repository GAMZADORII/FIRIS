# 향후 데이터 모델

이 문서는 개념적 관계만 기록한다. 현재 Entity, DDL, migration, 테이블, 시드 데이터는 만들지 않는다.
컬럼 타입, PK 생성 방식, 인덱스 및 전체 스키마는 향후 설계 단계에서 확정한다.

| 예정 테이블 | 역할 / 알려진 설계 요소 |
| --- | --- |
| ACCOUNT | ADMIN/WORKER, loginId, must_change_password, ACTIVE/INACTIVE. ADMIN 1개 사전 등록 예정 |
| CAMERA | 고정 CCTV, cameraId(camera-1 등), ONLINE/OFFLINE |
| FIRE_EVENT | 카메라 위험 이벤트, FIRE/SMOKE 및 필요 시 FIRE_SMOKE, Confidence, 발생 시각 |
| EVENT_MEDIA | 이벤트 미디어 경로(snapshot_path, video_path). Binary 저장 금지 |
| EVENT_REVIEW | 최종 검수 TRUE_FIRE/FALSE_POSITIVE, 오탐 사유, 검수자 |

## 관계
- CAMERA 1 : N FIRE_EVENT
- FIRE_EVENT 1 : 0..1 EVENT_MEDIA
- FIRE_EVENT 1 : 0..1 EVENT_REVIEW
- ACCOUNT 1 : N EVENT_REVIEW

이벤트는 미디어/검수 정보 없이 먼저 생성될 수 있다.
EVENT_MEDIA와 EVENT_REVIEW는 이벤트당 최대 한 행이 되도록 향후 제약을 설계한다.
작업자는 삭제하지 않고 비활성화하며 검수 이력을 유지한다.
오탐 사유 후보: STEAM, LIGHT, REFLECTION, DUST, WELDING, ETC.
