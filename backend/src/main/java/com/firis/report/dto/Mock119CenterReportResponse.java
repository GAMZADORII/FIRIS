package com.firis.report.dto;

import com.firis.report.entity.*;
import java.time.LocalDateTime;
import java.util.List;

public record Mock119CenterReportResponse(Long reportId, Long eventId, String requestId, String receiptId,
        String cameraId, String siteAddress, String detailLocation, String specialNotes,
        String eventType, double confidence, LocalDateTime detectedAt, LocalDateTime reportedAt,
        String reporterName, String reporterPhone, String controlRoomPhone,
        Mock119ResponseStatus responseStatus, LocalDateTime dispatchAt, LocalDateTime arrivalAt,
        LocalDateTime closedAt, List<History> history) {
    public record History(Mock119ResponseStatus status, LocalDateTime occurredAt) {}
    public static Mock119CenterReportResponse from(Mock119Report r) {
        var e = r.getEvent();
        return new Mock119CenterReportResponse(r.getReportId(), e.getEventId(), r.getRequestId(), r.getReceiptId(),
                e.getCamera().getCameraId(), r.getSiteAddress(), r.getDetailLocation(), r.getSpecialNotes(),
                e.getEventType().name(), e.getConfidence(), e.getDetectedAt(), r.getCreatedAt(),
                r.getReporter().getName(), r.getReporterPhone(), r.getControlRoomPhone(),
                r.getResponseStatus(), r.getDispatchAt(), r.getArrivalAt(), r.getClosedAt(),
                r.getHistory().stream().map(h -> new History(h.getStatus(), h.getOccurredAt())).toList());
    }
}
