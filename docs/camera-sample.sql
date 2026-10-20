-- 로컬 시연용. 앱과 같은 MySQL DB에서 수동 실행하세요.
-- 기존 CAM001~003은 URL만 수정하고 나머지 정보는 보존합니다.
-- ID가 없으면 시연 카메라를 등록합니다. 자동 실행되지 않습니다.
SET NAMES utf8mb4;

INSERT INTO camera (camera_id, camera_name, location, stream_url, status)
VALUES
('CAM001', 'FWW 정상 라벨 시연', '공장/창고/작업장 분류 샘플', 'http://localhost:8080/videos/camera01.mp4', 'ONLINE'),
('CAM002', 'FWW 불꽃 시연', '공장/창고/작업장 분류 샘플', 'http://localhost:8080/videos/camera02.mp4', 'ONLINE'),
('CAM003', 'FWW 연기 시연', '공장/창고/작업장 분류 샘플', 'http://localhost:8080/videos/camera03.mp4', 'ONLINE')
ON DUPLICATE KEY UPDATE stream_url = VALUES(stream_url);

SELECT camera_id, camera_name, location, stream_url, status
FROM camera ORDER BY camera_id;
