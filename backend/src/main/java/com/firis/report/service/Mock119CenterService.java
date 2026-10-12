package com.firis.report.service;

import com.firis.common.exception.*;
import com.firis.event.entity.ReviewResult;
import com.firis.event.repository.*;
import com.firis.report.dto.Mock119CenterReportResponse;
import com.firis.report.entity.*;
import com.firis.report.repository.Mock119ReportRepository;
import com.firis.report.websocket.Mock119CenterNotification;
import java.time.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Mock119CenterService {
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;
    private final Mock119ReportRepository reports;
    private final FireEventRepository events;
    private final EventReviewRepository reviews;
    private final ApplicationEventPublisher publisher;

    public Mock119CenterService(Mock119ReportRepository reports, FireEventRepository events,
            EventReviewRepository reviews, ApplicationEventPublisher publisher) {
        this.reports = reports; this.events = events; this.reviews = reviews; this.publisher = publisher;
    }

    @Transactional
    public String register(String requestId) {
        var initial = reports.findByRequestId(requestId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        var r = locked(initial.getReportId());
        if (r.getResponseStatus() == null) {
            r.registerAtCenter(now());
            r.accept("MOCK-" + r.getRequestId());
            changed(r, "REPORT_CREATED");
        }
        return r.getReceiptId();
    }

    @Transactional(readOnly = true)
    public Page<Mock119CenterReportResponse> list(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new ApiException(ErrorCode.BAD_REQUEST);
        return reports.findByResponseStatusIsNotNull(PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("reportId"))))
                .map(Mock119CenterReportResponse::from);
    }

    @Transactional(readOnly = true)
    public Mock119CenterReportResponse detail(Long reportId) {
        return Mock119CenterReportResponse.from(centerReport(reportId));
    }

    @Transactional(readOnly = true)
    public Long eventId(Long reportId) { return centerReport(reportId).getEvent().getEventId(); }

    @Transactional
    public Mock119CenterReportResponse transition(Long reportId, Mock119ResponseStatus expected,
            Mock119ResponseStatus target) {
        var r = locked(reportId);
        if (r.getResponseStatus() == null) throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        if (r.getResponseStatus() == target) return Mock119CenterReportResponse.from(r);
        if (r.getResponseStatus() != expected) throw new ApiException(ErrorCode.MOCK_119_STATE_CONFLICT);
        if (target == Mock119ResponseStatus.DISPATCHED && expected == Mock119ResponseStatus.PENDING) {
            r.dispatch(now());
        } else if (target == Mock119ResponseStatus.CLOSED && expected == Mock119ResponseStatus.ARRIVED) {
            if (reviews.findByEvent_EventId(r.getEvent().getEventId())
                    .filter(v -> v.getResult() == ReviewResult.FALSE_POSITIVE).isPresent()) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "오탐 검수된 이벤트는 대응 완료할 수 없습니다.");
            }
            var at = now();
            r.close(at);
            // Center completion is not a worker's fire-review decision.
            r.getEvent().completeResponse(at);
        } else throw new ApiException(ErrorCode.BAD_REQUEST, "허용되지 않는 대응 단계입니다.");
        changed(r, "REPORT_UPDATED");
        return Mock119CenterReportResponse.from(r);
    }

    @Transactional
    public void arrive(Long reportId) {
        var r = locked(reportId);
        var before = r.getResponseStatus();
        r.arrive(now());
        if (before != r.getResponseStatus()) changed(r, "REPORT_UPDATED");
    }

    private Mock119Report centerReport(Long id) {
        return reports.findById(id).filter(r -> r.getResponseStatus() != null)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
    }

    private Mock119Report locked(Long id) {
        // Every writer locks the event first (same order as submission/review).
        var r = reports.findById(id).orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));
        events.findForMediaUpdate(r.getEvent().getEventId())
                .orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND));
        entityManager.refresh(r);
        return r;
    }

    private void changed(Mock119Report r, String type) {
        publisher.publishEvent(new Mock119CenterNotification(type, r.getReportId(), r.getEvent().getEventId()));
    }
    private LocalDateTime now() { return LocalDateTime.now(ZoneId.of("Asia/Seoul")); }
}
