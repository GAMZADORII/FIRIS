package com.firis.event.dto;

import com.firis.event.entity.*;
import java.time.LocalDateTime;

public record EventReviewResponse(ReviewResult result, FalsePositiveReason falsePositiveReason,
        String note, Long reviewerId, String reviewerName, LocalDateTime reviewedAt) {
    public static EventReviewResponse from(EventReview review) {
        if (review == null) return null;
        return new EventReviewResponse(review.getResult(), review.getFalsePositiveReason(),
                review.getNote(), review.getReviewer().getAccountId(),
                review.getReviewer().getName(), review.getReviewedAt());
    }
}
