package com.firis.event;

import com.firis.account.entity.Account;
import com.firis.account.repository.AccountRepository;
import com.firis.camera.entity.Camera;
import com.firis.common.exception.ApiException;
import com.firis.event.dto.ReviewEventRequest;
import com.firis.event.entity.*;
import com.firis.event.repository.*;
import com.firis.event.service.EventQueryService;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EventQueryServiceTest {
    @Mock FireEventRepository events;
    @Mock EventMediaRepository media;
    @Mock EventReviewRepository reviews;
    @Mock AccountRepository accounts;
    EventQueryService service;

    @BeforeEach void setup() { service = new EventQueryService(events, media, reviews, accounts); }

    @Test void rejectsFalsePositiveWithoutReason() {
        assertThatThrownBy(() -> service.review(7L, "worker", new ReviewEventRequest(
                ReviewResult.FALSE_POSITIVE, null, null)))
                .isInstanceOf(ApiException.class);
        verifyNoInteractions(events, reviews);
    }

    @Test void rejectsSecondReviewWithoutChangingOriginal() {
        when(events.findForMediaUpdate(7L)).thenReturn(Optional.of(mock(FireEvent.class)));
        when(reviews.existsByEvent_EventId(7L)).thenReturn(true);
        assertThatThrownBy(() -> service.review(7L, "worker", new ReviewEventRequest(
                ReviewResult.TRUE_FIRE, null, null)))
                .isInstanceOf(ApiException.class).hasMessageContaining("이미 검수된");
        verify(reviews, never()).save(any());
    }

    @Test void reviewUsesAuthenticatedAccountAndReturnsPersistedResult() {
        var event = mock(FireEvent.class);
        var camera = Camera.create("camera-1", "CCTV 1", "창고", null, "ONLINE");
        var account = Account.createWorker("W000001", "hash", "작업자");
        when(event.getEventId()).thenReturn(7L);
        when(event.getCamera()).thenReturn(camera);
        when(events.findForMediaUpdate(7L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(account));
        when(reviews.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.review(7L, "W000001", new ReviewEventRequest(
                ReviewResult.FALSE_POSITIVE, FalsePositiveReason.STEAM, "증기 확인"));

        var saved = ArgumentCaptor.forClass(EventReview.class);
        verify(reviews).save(saved.capture());
        assertThat(saved.getValue().getReviewer()).isSameAs(account);
        assertThat(response.reviewStatus()).isEqualTo("FALSE_POSITIVE");
        assertThat(response.review().falsePositiveReason()).isEqualTo(FalsePositiveReason.STEAM);
    }

    @Test void timeoutAcceptsUnreviewedDetection() {
        var now = java.time.LocalDateTime.now();
        var camera = Camera.create("CAM001", "Camera", "Factory", null, "ONLINE");
        var event = new FireEvent(camera, EventType.FIRE, 0.95, now, "test", now);
        when(events.findForMediaUpdate(7L)).thenReturn(Optional.of(event));
        when(reviews.findByEvent_EventId(7L)).thenReturn(Optional.empty());
        var response = service.reportTimeout(7L);
        assertThat(response.reportTimedOutAt()).isNotNull();
        assertThat(response.reviewStatus()).isEqualTo("UNREVIEWED");
        verify(reviews, never()).save(any());
    }

    @Test void timeoutRejectsFalsePositive() {
        var event = mock(FireEvent.class);
        var review = mock(EventReview.class);
        when(events.findForMediaUpdate(7L)).thenReturn(Optional.of(event));
        when(reviews.findByEvent_EventId(7L)).thenReturn(Optional.of(review));
        when(review.getResult()).thenReturn(ReviewResult.FALSE_POSITIVE);
        assertThatThrownBy(() -> service.reportTimeout(7L)).isInstanceOf(ApiException.class);
        verify(event, never()).markReportTimedOut(any());
    }

    @Test void timeoutIsPersistedAndRepeatedCallsPreserveFirstTimestamp() {
        var now = java.time.LocalDateTime.of(2026, 10, 8, 12, 0);
        var camera = Camera.create("CAM001", "Camera", "Factory", null, "ONLINE");
        var event = new FireEvent(camera, EventType.FIRE, 0.95, now, "test", now);
        var reviewer = Account.createWorker("W000001", "hash", "Operator");
        var review = new EventReview(event, reviewer, ReviewResult.TRUE_FIRE, null, null, now);
        when(events.findForMediaUpdate(7L)).thenReturn(Optional.of(event));
        when(reviews.findByEvent_EventId(7L)).thenReturn(Optional.of(review));
        var first = service.reportTimeout(7L);
        var second = service.reportTimeout(7L);
        assertThat(first.reportTimedOutAt()).isNotNull();
        assertThat(second.reportTimedOutAt()).isEqualTo(first.reportTimedOutAt());
        assertThat(second.reviewStatus()).isEqualTo("TRUE_FIRE");
        assertThat(com.firis.event.dto.EventSummaryResponse.from(event, review).reportTimedOutAt())
                .isEqualTo(first.reportTimedOutAt());
        verify(reviews, never()).save(any());
    }

    @Test void completesResponseAndReviewsPendingEvent() {
        var now = java.time.LocalDateTime.now();
        var camera = Camera.create("CAM001", "Camera", "Factory", null, "ONLINE");
        var event = new FireEvent(camera, EventType.FIRE, 0.95, now, "test", now);
        event.markReportTimedOut(now.minusMinutes(1));
        var account = Account.createWorker("W000001", "hash", "Operator");
        when(events.findForMediaUpdate(7L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(account));
        when(reviews.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var result = service.completeResponse(7L, "W000001");
        assertThat(result.responseCompletedAt()).isNotNull();
        assertThat(result.reviewStatus()).isEqualTo("TRUE_FIRE");
        assertThat(result.reportTimedOutAt()).isEqualTo(now.minusMinutes(1));
        assertThatThrownBy(() -> service.reportTimeout(7L)).isInstanceOf(ApiException.class);
    }

    @Test void completionDoesNotOverwriteExistingReviewAndIsIdempotent() {
        var now = java.time.LocalDateTime.now();
        var camera = Camera.create("CAM001", "Camera", "Factory", null, "ONLINE");
        var event = new FireEvent(camera, EventType.FIRE, 0.95, now, "test", now);
        var account = Account.createWorker("W000001", "hash", "Operator");
        var review = new EventReview(event, account, ReviewResult.TRUE_FIRE, null, null, now);
        when(events.findForMediaUpdate(7L)).thenReturn(Optional.of(event));
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(account));
        when(reviews.findByEvent_EventId(7L)).thenReturn(Optional.of(review));
        var first = service.completeResponse(7L, "W000001");
        assertThat(service.completeResponse(7L, "W000001").responseCompletedAt()).isEqualTo(first.responseCompletedAt());
        verify(reviews, never()).save(any());
    }
}
