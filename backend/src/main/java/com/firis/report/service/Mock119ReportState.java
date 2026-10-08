package com.firis.report.service;

import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import com.firis.event.repository.FireEventRepository;
import com.firis.report.dto.Mock119ReportResponse;
import com.firis.report.entity.Mock119Report;
import com.firis.report.entity.Mock119ReportStatus;
import com.firis.report.repository.Mock119ReportRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Mock119ReportState {
    private final FireEventRepository events;
    private final AccountRepository accounts;
    private final Mock119ReportRepository reports;

    public Mock119ReportState(FireEventRepository events, AccountRepository accounts,
            Mock119ReportRepository reports) {
        this.events = events;
        this.accounts = accounts;
        this.reports = reports;
    }

    @Transactional
    public Prepared prepare(Long eventId, String loginId, String controlRoomPhone) {
        var event = events.findForMediaUpdate(eventId)
                .orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND));
        var reporter = accounts.findByLoginId(loginId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        if (reporter.getRole() != Role.WORKER || !reporter.isActive()) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        if (reporter.getContactPhone() == null || reporter.getContactConsentedAt() == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "신고자 연락처와 개인정보 동의를 먼저 등록해주세요.");
        }
        if (controlRoomPhone == null || !controlRoomPhone.matches("^0\\d{1,2}-?\\d{3,4}-?\\d{4}$")) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "올바른 관제실 번호를 입력해주세요.");
        }
        String normalizedPhone = controlRoomPhone.replace("-", "");
        var existing = reports.findByEvent_EventId(eventId);
        Mock119Report report;
        if (existing.isPresent()) {
            report = existing.get();
            if (!report.getReporter().getLoginId().equals(loginId)) {
                throw new ApiException(ErrorCode.FORBIDDEN, "기존 신고자만 재시도할 수 있습니다.");
            }
            if (!report.getControlRoomPhone().equals(normalizedPhone)) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "재시도에는 최초 신고의 관제실 번호를 사용해주세요.");
            }
            if (report.getStatus() == Mock119ReportStatus.ACCEPTED) {
                return new Prepared(report.getReportId(), false, null);
            }
            if (report.getStatus() == Mock119ReportStatus.PENDING && report.getUpdatedAt() != null
                    && report.getUpdatedAt().isAfter(LocalDateTime.now().minusSeconds(15))) {
                return new Prepared(report.getReportId(), false, null);
            }
            report.retry();
        } else {
            report = new Mock119Report(event, reporter, UUID.randomUUID().toString(),
                    reporter.getContactPhone(), normalizedPhone);
        }
        reports.saveAndFlush(report);
        Mock119Message message = new Mock119Message(
                "FIRE_REPORT", report.getRequestId(), eventId, event.getCamera().getCameraId(),
                event.getCamera().getLocation(), event.getEventType().name(), event.getDetectedAt(),
                reporter.getLoginId(), reporter.getName(), report.getReporterPhone(), report.getControlRoomPhone()
        );
        return new Prepared(report.getReportId(), true, message);
    }

    @Transactional
    public void accepted(Long reportId, String receiptId) {
        var report = reports.findById(reportId)
                .orElseThrow(() -> new ApiException(ErrorCode.INTERNAL_SERVER_ERROR));
        report.accept(receiptId);
    }

    @Transactional
    public void failed(Long reportId, String reason) {
        reports.findById(reportId).ifPresent(report -> report.fail(reason));
    }

    @Transactional(readOnly = true)
    public Mock119ReportResponse byId(Long reportId) {
        return reports.findById(reportId).map(Mock119ReportResponse::from)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public Mock119ReportResponse byEventId(Long eventId) {
        return reports.findByEvent_EventId(eventId).map(Mock119ReportResponse::from)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }

    public record Prepared(Long reportId, boolean send, Mock119Message message) {}
}
