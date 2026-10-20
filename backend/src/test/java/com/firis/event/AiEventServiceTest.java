package com.firis.event;

import com.firis.camera.entity.Camera;
import com.firis.camera.repository.CameraRepository;
import com.firis.event.dto.CreateAiEventRequest;
import com.firis.event.dto.UpdateAiMediaRequest;
import com.firis.event.entity.EventMedia;
import com.firis.event.entity.EventType;
import com.firis.event.entity.FireEvent;
import com.firis.event.exception.AiEventException;
import com.firis.event.repository.EventMediaRepository;
import com.firis.event.repository.FireEventRepository;
import com.firis.event.service.AiEventService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiEventServiceTest {
    @Mock CameraRepository cameras;
    @Mock FireEventRepository events;
    @Mock EventMediaRepository media;
    AiEventService service;

    @BeforeEach void setUp() {
        service = new AiEventService(cameras, events, media);
    }

    @Test void createsEventAndSnapshotMediaBeforeVideoExists() {
        Camera camera = newCamera();
        when(cameras.findById("camera-1")).thenReturn(Optional.of(camera));
        when(events.save(any(FireEvent.class))).thenAnswer(call -> {
            FireEvent event = call.getArgument(0);
            ReflectionTestUtils.setField(event, "eventId", 31L);
            return event;
        });

        var response = service.create(new CreateAiEventRequest("camera-1", EventType.SMOKE, 0.91,
            LocalDateTime.of(2026, 10, 7, 14, 30, 25), "/storage/events/snapshot.jpg", "fire-v1"));

        assertThat(response.eventId()).isEqualTo(31L);
        assertThat(response.reviewStatus()).isEqualTo("UNREVIEWED");
        var mediaCaptor = org.mockito.ArgumentCaptor.forClass(EventMedia.class);
        verify(media).save(mediaCaptor.capture());
        EventMedia saved = mediaCaptor.getValue();
        assertThat(ReflectionTestUtils.getField(saved, "snapshotPath")).isEqualTo("/storage/events/snapshot.jpg");
        assertThat(ReflectionTestUtils.getField(saved, "videoPath")).isNull();
        assertThat(ReflectionTestUtils.getField(saved, "event")).isInstanceOf(FireEvent.class);
    }

    @Test void updatesVideoWithoutReplacingSnapshot() {
        FireEvent event = newEvent(newCamera());
        EventMedia existing = new EventMedia(event, "/storage/events/snapshot.jpg", LocalDateTime.now());
        when(events.findForMediaUpdate(31L)).thenReturn(Optional.of(event));
        when(media.findByEvent_EventId(31L)).thenReturn(Optional.of(existing));

        var response = service.updateMedia(31L,
            new UpdateAiMediaRequest("/storage/events/video.mp4", 5, 5));

        assertThat(response.eventId()).isEqualTo(31L);
        assertThat(response.videoAvailable()).isTrue();
        assertThat(ReflectionTestUtils.getField(existing, "snapshotPath")).isEqualTo("/storage/events/snapshot.jpg");
        assertThat(ReflectionTestUtils.getField(existing, "videoPath")).isEqualTo("/storage/events/video.mp4");
        assertThat(ReflectionTestUtils.getField(existing, "preSeconds")).isEqualTo(5);
        assertThat(ReflectionTestUtils.getField(existing, "postSeconds")).isEqualTo(5);
        verify(media).save(existing);
    }

    @Test void rejectsUnknownCameraBeforeWriting() {
        when(cameras.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.create(new CreateAiEventRequest("missing", EventType.FIRE, 0.8,
            LocalDateTime.now(), "/storage/events/snapshot.jpg", null)))
            .isInstanceOf(AiEventException.class)
            .hasMessageContaining("CCTV");
        verifyNoInteractions(events, media);
    }

    private Camera newCamera() {
        return org.mockito.Mockito.mock(Camera.class);
    }

    private FireEvent newEvent(Camera camera) {
        FireEvent event = new FireEvent(camera, EventType.SMOKE, 0.91,
            LocalDateTime.now(), null, LocalDateTime.now());
        ReflectionTestUtils.setField(event, "eventId", 31L);
        return event;
    }
}
