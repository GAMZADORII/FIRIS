package com.firis.report.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "MOCK_119_REPORT_HISTORY")
public class Mock119ReportHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long historyId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    private Mock119Report report;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Mock119ResponseStatus status;
    @Column(nullable = false)
    private LocalDateTime occurredAt;

    protected Mock119ReportHistory() {}
    public Mock119ReportHistory(Mock119Report report, Mock119ResponseStatus status, LocalDateTime at) {
        this.report = report; this.status = status; this.occurredAt = at;
    }
    public Mock119ResponseStatus getStatus() { return status; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
}
