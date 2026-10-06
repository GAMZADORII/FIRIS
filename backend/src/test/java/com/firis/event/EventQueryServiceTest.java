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
}
