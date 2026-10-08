package com.firis.report.service;

import java.time.LocalDateTime;

public record Mock119Message(
        String type,
        String requestId,
        Long eventId,
        String cameraId,
        String siteAddress,
        String detailLocation,
        String specialNotes,
        String eventType,
        LocalDateTime detectedAt,
        String reporterLoginId,
        String reporterName,
        String reporterPhone,
        String controlRoomPhone
) {
}
