package com.firis.camera.dto;

import com.firis.camera.entity.Camera;

public record CameraResponse(
        String cameraId,
        String cameraName,
        String location,
        String streamUrl,
        String status,
        String reportNote
) {
    public static CameraResponse from(Camera camera) {
        return new CameraResponse(
                camera.getCameraId(),
                camera.getCameraName(),
                camera.getLocation(),
                camera.getStreamUrl(),
                camera.getStatus(),
                camera.getReportNote()
        );
    }
}
