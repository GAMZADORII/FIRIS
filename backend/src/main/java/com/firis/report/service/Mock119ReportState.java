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
        if ((reporter.getRole() != Role.WORKER && reporter.getRole() != Role.ADMIN) || !reporter.isActive()) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        var missing = new ArrayList<String>();
        // These display fields are optional. Only supplied, invalid values block sending.
        if (settings.siteAddress().length() > 255) missing.add("siteAddress");
        if (!optionalPhoneValid(settings.controlRoomPhone())) missing.add("controlRoomPhone");
        if (!optionalPhoneValid(reporter.getContactPhone())) missing.add("reporterPhone");
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
        if ((reporter.getRole() != Role.WORKER && reporter.getRole() != Role.ADMIN) || !reporter.isActive()) {
            throw new ApiException(ErrorCode.FORBIDDEN);
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
                    && report.getUpdatedAt().isAfter(LocalDateTime.now(java.time.ZoneId.of("Asia/Seoul")).minusSeconds(15))) {
                return new Prepared(report.getReportId(), false, null);
            }
            report.retry();
        } else {
            if (event.getResponseCompletedAt() != null) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "대응 완료된 이벤트는 신규 신고할 수 없습니다.");
            }
            if (settings.siteAddress().length() > 255
                    || !optionalPhoneValid(settings.controlRoomPhone())
                    || !optionalPhoneValid(reporter.getContactPhone())) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "입력한 주소 또는 전화번호 형식을 확인해주세요.");
            }
            report = new Mock119Report(event, reporter, UUID.randomUUID().toString(),
                    normalizedPhone(reporter.getContactPhone()), normalizedPhone(settings.controlRoomPhone()),
                    settings.siteAddress(), event.getCamera().getLocation(), event.getCamera().getReportNote());
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
        if (report.getStatus() == Mock119ReportStatus.ACCEPTED) return;
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

    private boolean optionalPhoneValid(String phone) {
        return phone == null || phone.isBlank() || validPhone(phone.trim());
    }

    private String normalizedPhone(String phone) {
        // Existing NOT NULL phone columns accept empty strings; no migration is required.
        return phone == null ? "" : phone.trim().replace("-", "");
    }

    private boolean validPhone(String phone) {
        return phone != null && phone.matches("^0\\d{1,2}-?\\d{3,4}-?\\d{4}$");
    }
}
