package com.firis.report.dto;

import com.firis.report.entity.Mock119Report;
import com.firis.report.entity.Mock119ReportStatus;
import com.firis.report.entity.Mock119ResponseStatus;

public record Mock119ReportResponse(
        Long reportId,
        Long eventId,
        Mock119ReportStatus status,
        String receiptId,
        Mock119ResponseStatus responseStatus
) {
    public Mock119ReportResponse(Long reportId, Long eventId, Mock119ReportStatus status, String receiptId) {
        this(reportId, eventId, status, receiptId, null);
    }
    public static Mock119ReportResponse from(Mock119Report report) {
        return new Mock119ReportResponse(report.getReportId(), report.getEvent().getEventId(),
                report.getStatus(), report.getReceiptId(), report.getResponseStatus());
    }
}
