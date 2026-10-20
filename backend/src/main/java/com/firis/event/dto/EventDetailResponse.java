package com.firis.event.dto;

import com.firis.event.entity.*;
import java.time.LocalDateTime;

public record EventDetailResponse(Long eventId, String cameraId, String cameraName, String location,
        EventType eventType, double confidence, LocalDateTime detectedAt, String modelVersion,
        String reviewStatus, String snapshotPath, String videoPath,
        Integer preSeconds, Integer postSeconds, EventReviewResponse review, LocalDateTime reportTimedOutAt, LocalDateTime responseCompletedAt) {
    public static EventDetailResponse from(FireEvent event, EventMedia media, EventReview review) {
        var summary = EventSummaryResponse.from(event, review);
        return new EventDetailResponse(summary.eventId(), summary.cameraId(), summary.cameraName(),
                summary.location(), summary.eventType(), summary.confidence(), summary.detectedAt(),
                summary.modelVersion(), summary.reviewStatus(),
                media == null ? null : media.getSnapshotPath(),
                media == null ? null : media.getVideoPath(),
                media == null ? null : media.getPreSeconds(),
                media == null ? null : media.getPostSeconds(), EventReviewResponse.from(review), event.getReportTimedOutAt(), event.getResponseCompletedAt());
    }
}
