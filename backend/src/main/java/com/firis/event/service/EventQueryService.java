package com.firis.event.service;

import com.firis.account.repository.AccountRepository;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import com.firis.event.dto.*;
import com.firis.event.entity.*;
import com.firis.event.repository.*;
import jakarta.persistence.criteria.Subquery;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventQueryService {
    private final FireEventRepository events;
    private final EventMediaRepository media;
    private final EventReviewRepository reviews;
    private final AccountRepository accounts;

    public EventQueryService(FireEventRepository events, EventMediaRepository media,
            EventReviewRepository reviews, AccountRepository accounts) {
        this.events = events; this.media = media; this.reviews = reviews; this.accounts = accounts;
    }

    @Transactional(readOnly = true)
    public EventPageResponse list(int page, int size, EventType eventType,
            String reviewStatus, String cameraId, LocalDate from, LocalDate to) {
        if (page < 0 || size < 1 || size > 100 || (from != null && to != null && from.isAfter(to))) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        ReviewResult reviewResult = null;
        if (reviewStatus != null && !reviewStatus.isBlank() && !reviewStatus.equals("UNREVIEWED")) {
            try { reviewResult = ReviewResult.valueOf(reviewStatus); }
            catch (IllegalArgumentException e) { throw new ApiException(ErrorCode.BAD_REQUEST); }
        }
        final ReviewResult resultFilter = reviewResult;
        Specification<FireEvent> filter = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (eventType != null) predicates.add(cb.equal(root.get("eventType"), eventType));
            if (cameraId != null && !cameraId.isBlank()) predicates.add(cb.equal(root.get("camera").get("cameraId"), cameraId));
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("detectedAt"), from.atStartOfDay()));
            if (to != null) predicates.add(cb.lessThan(root.get("detectedAt"), to.plusDays(1).atStartOfDay()));
            if (reviewStatus != null && !reviewStatus.isBlank()) {
                Subquery<Long> subquery = query.subquery(Long.class);
                var review = subquery.from(EventReview.class);
                subquery.select(review.get("reviewId"));
                var matchesEvent = cb.equal(review.get("event").get("eventId"), root.get("eventId"));
                subquery.where(resultFilter == null ? matchesEvent : cb.and(matchesEvent, cb.equal(review.get("result"), resultFilter)));
                predicates.add(reviewStatus.equals("UNREVIEWED") ? cb.not(cb.exists(subquery)) : cb.exists(subquery));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
        var result = events.findAll(filter, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("detectedAt"), Sort.Order.desc("eventId"))));
        var ids = result.getContent().stream().map(FireEvent::getEventId).toList();
        Map<Long, EventReview> byEvent = new HashMap<>();
        if (!ids.isEmpty()) reviews.findByEvent_EventIdIn(ids).forEach(r -> byEvent.put(r.getEvent().getEventId(), r));
        return EventPageResponse.from(result.map(e -> EventSummaryResponse.from(e, byEvent.get(e.getEventId()))));
    }

    @Transactional(readOnly = true)
    public EventDetailResponse detail(Long eventId) {
        var event = events.findById(eventId).orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND));
        return EventDetailResponse.from(event, media.findByEvent_EventId(eventId).orElse(null),
                reviews.findByEvent_EventId(eventId).orElse(null));
    }

    @Transactional
    public EventDetailResponse completeResponse(Long eventId, String loginId) {
        var event = events.findForMediaUpdate(eventId).orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND));
        var reviewer = accounts.findByLoginId(loginId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        var review = reviews.findByEvent_EventId(eventId).orElse(null);
        if (review != null && review.getResult() == ReviewResult.FALSE_POSITIVE) throw new ApiException(ErrorCode.BAD_REQUEST);
        var now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        if (review == null) review = reviews.save(new EventReview(event, reviewer, ReviewResult.TRUE_FIRE, null, "On-site response completed", now));
        event.completeResponse(now);
        return EventDetailResponse.from(event, media.findByEvent_EventId(eventId).orElse(null), review);
    }

    @Transactional
    public EventDetailResponse reportTimeout(Long eventId) {
        var event = events.findForMediaUpdate(eventId).orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND));
        var review = reviews.findByEvent_EventId(eventId).orElse(null);
        if (review != null && review.getResult() == ReviewResult.FALSE_POSITIVE) throw new ApiException(ErrorCode.BAD_REQUEST);
        if (event.getResponseCompletedAt() != null) throw new ApiException(ErrorCode.BAD_REQUEST);
        event.markReportTimedOut(LocalDateTime.now(ZoneId.of("Asia/Seoul")));
        return EventDetailResponse.from(event, media.findByEvent_EventId(eventId).orElse(null), review);
    }

    @Transactional
    public EventDetailResponse review(Long eventId, String loginId, ReviewEventRequest request) {
        if (request.result() == null || (request.result() == ReviewResult.FALSE_POSITIVE && request.falsePositiveReason() == null)
                || (request.result() == ReviewResult.TRUE_FIRE && request.falsePositiveReason() != null)) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        var event = events.findForMediaUpdate(eventId).orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND));
        if (reviews.existsByEvent_EventId(eventId)) throw new ApiException(ErrorCode.EVENT_ALREADY_REVIEWED);
        var reviewer = accounts.findByLoginId(loginId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        var review = reviews.save(new EventReview(event, reviewer, request.result(),
                request.falsePositiveReason(), request.note(), LocalDateTime.now(ZoneId.of("Asia/Seoul"))));
        return EventDetailResponse.from(event, media.findByEvent_EventId(eventId).orElse(null), review);
    }
}
