package com.firis.report.dto;

import com.firis.event.entity.EventType;
import java.time.LocalDateTime;
import java.util.List;

public record Mock119PreviewResponse(
        Long eventId,
        EventType eventType,
        String siteAddress,
        String controlRoomPhone,
        String detailLocation,
        LocalDateTime detectedAt,
        String reporterName,
        String reporterPhone,
        String specialNotes,
        boolean readyToReport,
        List<String> missingFields
) {}
