package com.firis.report.service;

import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import com.firis.event.repository.FireEventRepository;
import com.firis.report.dto.Mock119ReportResponse;
import com.firis.report.dto.Mock119PreviewResponse;
import com.firis.report.entity.Mock119Report;
import com.firis.report.entity.Mock119ReportStatus;
import com.firis.report.repository.Mock119ReportRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Mock119ReportState {
    private final FireEventRepository events;
    private final AccountRepository accounts;
    private final Mock119ReportRepository reports;
    private final Mock119Settings settings;

    public Mock119ReportState(FireEventRepository events, AccountRepository accounts,
            Mock119ReportRepository reports, Mock119Settings settings) {
        this.events = events;
        this.accounts = accounts;
        this.reports = reports;
        this.settings = settings;
    }

    @Transactional(readOnly = true)
    public Mock119PreviewResponse preview(Long eventId, String loginId) {
        var event = events.findById(eventId)
                .orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND));
        var reporter = accounts.findByLoginId(loginId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        if (reporter.getRole() != Role.WORKER || !reporter.isActive()) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        var missing = new ArrayList<String>();
        if (settings.siteAddress().isBlank() || settings.siteAddress().length() > 255) missing.add("siteAddress");
        if (!validPhone(settings.controlRoomPhone())) missing.add("controlRoomPhone");
        if (event.getCamera().getLocation() == null || event.getCamera().getLocation().isBlank()) {
            missing.add("detailLocation");
        }
        if (!validPhone(reporter.getContactPhone()) || reporter.getContactConsentedAt() == null) {
            missing.add("reporterPhone");
        }
        return new Mock119PreviewResponse(eventId, event.getEventType(),
                settings.siteAddress().isBlank() ? null : settings.siteAddress(),
                validPhone(settings.controlRoomPhone()) ? settings.controlRoomPhone() : null,
                event.getCamera().getLocation(), event.getDetectedAt(), reporter.getName(),
                reporter.getContactPhone(), event.getCamera().getReportNote(),
                missing.isEmpty(), missing);
    }

    @Transactional
    public Prepared prepare(Long eventId, String loginId) {
        var event = events.findForMediaUpdate(eventId)
                .orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND));
        var reporter = accounts.findByLoginId(loginId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        if (reporter.getRole() != Role.WORKER || !reporter.isActive()) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        if (!validPhone(reporter.getContactPhone()) || reporter.getContactConsentedAt() == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "신고자 연락처와 개인정보 동의를 먼저 등록해주세요.");
        }
        var existing = reports.findByEvent_EventId(eventId);
        Mock119Report report;
        if (existing.isPresent()) {
            report = existing.get();
            if (!report.getReporter().getLoginId().equals(loginId)) {
                throw new ApiException(ErrorCode.FORBIDDEN, "기존 신고자만 재시도할 수 있습니다.");
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
            if (settings.siteAddress().isBlank() || settings.siteAddress().length() > 255
                    || !validPhone(settings.controlRoomPhone())
                    || event.getCamera().getLocation() == null || event.getCamera().getLocation().isBlank()) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "사업장 주소·관제실 번호·상세위치를 설정해주세요.");
            }
            report = new Mock119Report(event, reporter, UUID.randomUUID().toString(),
                    reporter.getContactPhone(), settings.controlRoomPhone().replace("-", ""), settings.siteAddress(),
                    event.getCamera().getLocation(), event.getCamera().getReportNote());
        }
        reports.saveAndFlush(report);
        Mock119Message message = new Mock119Message(
                "FIRE_REPORT", report.getRequestId(), eventId, event.getCamera().getCameraId(),
                report.getSiteAddress(), report.getDetailLocation(), report.getSpecialNotes(),
                event.getEventType().name(), event.getDetectedAt(),
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

    private boolean validPhone(String phone) {
        return phone != null && phone.matches("^0\\d{1,2}-?\\d{3,4}-?\\d{4}$");
    }
}
