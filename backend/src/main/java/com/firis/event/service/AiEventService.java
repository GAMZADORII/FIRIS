package com.firis.event.service;

import com.firis.camera.repository.CameraRepository;
import com.firis.event.dto.*;
import com.firis.event.entity.*;
import com.firis.event.exception.AiEventException;
import com.firis.event.repository.*;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AiEventService {
    private final CameraRepository cameras;
    private final FireEventRepository events;
    private final EventMediaRepository media;

    public AiEventService(CameraRepository cameras, FireEventRepository events, EventMediaRepository media) {
        this.cameras = cameras; this.events = events; this.media = media;
    }
    private LocalDateTime now() { return LocalDateTime.now(ZoneId.of("Asia/Seoul")); }

    @Transactional
    public CreateAiEventResponse create(CreateAiEventRequest request) {
        var camera = cameras.findById(request.cameraId()).orElseThrow(() ->
            new AiEventException(HttpStatus.NOT_FOUND, "CAMERA_NOT_FOUND", "등록되지 않은 CCTV입니다."));
        if (!Double.isFinite(request.confidence())) {
            throw new AiEventException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Confidence가 올바르지 않습니다.");
        }
        var timestamp = now();
        var event = events.save(new FireEvent(camera, request.eventType(), request.confidence(),
            request.detectedAt(), request.modelVersion(), timestamp));
        media.save(new EventMedia(event, request.snapshotPath(), timestamp));
        return new CreateAiEventResponse(event.getEventId(), "UNREVIEWED");
    }

    @Transactional
    public UpdateAiMediaResponse updateMedia(Long eventId, UpdateAiMediaRequest request) {
        var event = events.findForMediaUpdate(eventId).orElseThrow(() ->
            new AiEventException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "이벤트를 찾을 수 없습니다."));
        var timestamp = now();
        var eventMedia = media.findByEvent_EventId(eventId)
            .orElseGet(() -> new EventMedia(event, null, timestamp));
        eventMedia.updateVideo(request.videoPath(), request.preSeconds(), request.postSeconds(), timestamp);
        media.save(eventMedia);
        return new UpdateAiMediaResponse(eventId, true);
    }
}
