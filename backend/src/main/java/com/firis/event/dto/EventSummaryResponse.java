package com.firis.event.dto;

import com.firis.event.entity.*;
import java.time.LocalDateTime;

public record EventSummaryResponse(Long eventId, String cameraId, String cameraName, String location,
        EventType eventType, double confidence, LocalDateTime detectedAt,
        String modelVersion, String reviewStatus, LocalDateTime reportTimedOutAt, LocalDateTime responseCompletedAt) {
    public static EventSummaryResponse from(FireEvent event, EventReview review) {
        var camera = event.getCamera();
        return new EventSummaryResponse(event.getEventId(), camera.getCameraId(),
                camera.getCameraName(), camera.getLocation(), event.getEventType(),
                event.getConfidence(), event.getDetectedAt(), event.getModelVersion(),
                review == null ? "UNREVIEWED" : review.getResult().name(), event.getReportTimedOutAt(), event.getResponseCompletedAt());
    }
}
