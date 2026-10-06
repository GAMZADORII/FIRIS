package com.firis.event.entity;

import com.firis.account.entity.Account;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "EVENT_REVIEW")
public class EventReview {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "review_id")
    private Long reviewId;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false, unique = true)
    private FireEvent event;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reviewer_id", nullable = false)
    private Account reviewer;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ReviewResult result;
    @Enumerated(EnumType.STRING)
    @Column(name = "false_positive_reason", length = 30)
    private FalsePositiveReason falsePositiveReason;
    @Column(length = 500)
    private String note;
    @Column(name = "reviewed_at", nullable = false)
    private LocalDateTime reviewedAt;

    protected EventReview() {}
    public EventReview(FireEvent event, Account reviewer, ReviewResult result,
            FalsePositiveReason reason, String note, LocalDateTime reviewedAt) {
        this.event = event; this.reviewer = reviewer; this.result = result;
        this.falsePositiveReason = reason; this.note = note; this.reviewedAt = reviewedAt;
    }
    public FireEvent getEvent() { return event; }
    public Account getReviewer() { return reviewer; }
    public ReviewResult getResult() { return result; }
    public FalsePositiveReason getFalsePositiveReason() { return falsePositiveReason; }
    public String getNote() { return note; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
}
