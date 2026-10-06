package com.firis.camera.config;

import com.firis.camera.dto.CreateCameraRequest;
import com.firis.camera.repository.CameraRepository;
import com.firis.camera.service.CameraService;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class CameraInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CameraInitializer.class);

    private final CameraRepository cameraRepository;
    private final CameraService cameraService;
    private final String cameraBaseUrl;

    public CameraInitializer(
            CameraRepository cameraRepository,
            CameraService cameraService,
            @Value("${app.camera.base-url:http://localhost:8080}") String cameraBaseUrl
    ) {
        this.cameraRepository = cameraRepository;
        this.cameraService = cameraService;
        this.cameraBaseUrl = cameraBaseUrl.replaceAll("/+$", "");
    }

    @Override
    public void run(ApplicationArguments args) {
        createIfMissing(
                "CAM001",
                "CCTV 01",
                "공장 A구역",
                "/videos/CAM001/001.mp4"
        );

        createIfMissing(
                "CAM002",
                "CCTV 02",
                "공장 B구역",
                "/videos/CAM002/001.mp4"
        );

        createIfMissing(
                "CAM003",
                "CCTV 03",
                "창고 A구역",
                "/videos/CAM003/001.mp4"
        );

        createIfMissing(
                "CAM004",
                "CCTV 04",
                "창고 B구역",
                "/videos/CAM004/001.mp4"
        );
    }

    private void createIfMissing(
            String cameraId,
            String cameraName,
            String location,
            String videoPath
    ) {
        if (cameraRepository.existsById(cameraId)) {
            log.info("기본 CCTV가 이미 존재하여 생성을 건너뜁니다. cameraId={}", cameraId);
            return;
        }

        try {
            // Reuse insert-only registration so a concurrent insert cannot be merged/overwritten.
            cameraService.createCamera(new CreateCameraRequest(
                    cameraId, cameraName, location, cameraBaseUrl + videoPath, "ONLINE"
            ));
        } catch (ApiException exception) {
            if (exception.getErrorCode() != ErrorCode.CAMERA_ALREADY_EXISTS) {
                throw exception;
            }
            log.info("기본 CCTV가 이미 존재하여 생성을 건너뜁니다. cameraId={}", cameraId);
            return;
        }

        log.info("기본 CCTV가 생성되었습니다. cameraId={}", cameraId);
    }
}
