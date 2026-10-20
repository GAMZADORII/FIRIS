package com.firis.report.entity;

import com.firis.account.entity.Account;
import com.firis.event.entity.FireEvent;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "MOCK_119_REPORT", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mock_119_report_event", columnNames = "event_id"),
        @UniqueConstraint(name = "uk_mock_119_report_request", columnNames = "request_id")
})
public class Mock119Report {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_id")
    private Long reportId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private FireEvent event;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private Account reporter;

    @Column(name = "request_id", nullable = false, length = 36)
    private String requestId;

    @Column(name = "reporter_phone", nullable = false, length = 20)
    private String reporterPhone;

    @Column(name = "control_room_phone", nullable = false, length = 20)
    private String controlRoomPhone;

    @Column(name = "site_address", length = 255)
    private String siteAddress;

    @Column(name = "detail_location", length = 100)
    private String detailLocation;

    @Column(name = "special_notes", length = 500)
    private String specialNotes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Mock119ReportStatus status;

    @Column(name = "receipt_id", length = 100)
    private String receiptId;

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    // Nullable for legacy reports sent to an external center.
    @Enumerated(EnumType.STRING)
    @Column(name = "response_status", length = 20)
    private Mock119ResponseStatus responseStatus;
    private LocalDateTime dispatchAt;
    private LocalDateTime arrivalAt;
    private LocalDateTime closedAt;

    @OneToMany(mappedBy = "report", cascade = CascadeType.ALL)
    @OrderBy("occurredAt ASC, historyId ASC")
    private List<Mock119ReportHistory> history = new ArrayList<>();

    public void registerAtCenter(LocalDateTime now) {
        if (responseStatus != null) return;
        responseStatus = Mock119ResponseStatus.PENDING;
        history.add(new Mock119ReportHistory(this, responseStatus, now));
    }

    public void dispatch(LocalDateTime now) {
        if (responseStatus != Mock119ResponseStatus.PENDING) throw new IllegalStateException("Invalid dispatch");
        responseStatus = Mock119ResponseStatus.DISPATCHED;
        dispatchAt = now;
        arrivalAt = now.plusSeconds(60);
        history.add(new Mock119ReportHistory(this, responseStatus, now));
    }

    public void arrive(LocalDateTime now) {
        if (responseStatus != Mock119ResponseStatus.DISPATCHED || arrivalAt.isAfter(now)) return;
        responseStatus = Mock119ResponseStatus.ARRIVED;
        history.add(new Mock119ReportHistory(this, responseStatus, arrivalAt));
    }

    public void close(LocalDateTime now) {
        if (responseStatus != Mock119ResponseStatus.ARRIVED) throw new IllegalStateException("Invalid completion");
        responseStatus = Mock119ResponseStatus.CLOSED;
        closedAt = now;
        history.add(new Mock119ReportHistory(this, responseStatus, now));
    }

    protected Mock119Report() {}

    public Mock119Report(FireEvent event, Account reporter, String requestId,
            String reporterPhone, String controlRoomPhone, String siteAddress,
            String detailLocation, String specialNotes) {
        this.event = event;
        this.reporter = reporter;
        this.requestId = requestId;
        this.reporterPhone = reporterPhone;
        this.controlRoomPhone = controlRoomPhone;
        this.siteAddress = siteAddress;
        this.detailLocation = detailLocation;
        this.specialNotes = specialNotes;
        this.status = Mock119ReportStatus.PENDING;
    }

    public void retry() {
        status = Mock119ReportStatus.PENDING;
        failureReason = null;
        updatedAt = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
    }

    public void accept(String receiptId) {
        status = Mock119ReportStatus.ACCEPTED;
        this.receiptId = receiptId;
        failureReason = null;
        acceptedAt = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
    }

    public void fail(String reason) {
        if (status == Mock119ReportStatus.ACCEPTED) return;
        status = Mock119ReportStatus.FAILED;
        failureReason = reason == null ? "전송 실패" : reason.substring(0, Math.min(reason.length(), 255));
    }

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
    }

    public Long getReportId() { return reportId; }
    public FireEvent getEvent() { return event; }
    public Account getReporter() { return reporter; }
    public String getRequestId() { return requestId; }
    public String getReporterPhone() { return reporterPhone; }
    public String getControlRoomPhone() { return controlRoomPhone; }
    public String getSiteAddress() { return siteAddress; }
    public String getDetailLocation() { return detailLocation; }
    public String getSpecialNotes() { return specialNotes; }
    public Mock119ReportStatus getStatus() { return status; }
    public String getReceiptId() { return receiptId; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public LocalDateTime getAcceptedAt() { return acceptedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Mock119ResponseStatus getResponseStatus() { return responseStatus; }
    public LocalDateTime getDispatchAt() { return dispatchAt; }
    public LocalDateTime getArrivalAt() { return arrivalAt; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public List<Mock119ReportHistory> getHistory() { return history; }
}
