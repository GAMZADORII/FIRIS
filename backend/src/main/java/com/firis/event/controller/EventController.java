package com.firis.event.controller;

import com.firis.event.dto.*;
import com.firis.event.entity.EventType;
import com.firis.event.service.EventQueryService;
import com.firis.event.service.EventStreamService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.http.MediaType;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/events")
public class EventController {
    private final EventQueryService service;
    private final EventStreamService stream;
    public EventController(EventQueryService service, EventStreamService stream) {
        this.service = service; this.stream = stream;
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> stream() {
        return ResponseEntity.ok().cacheControl(CacheControl.noCache())
                .header("X-Accel-Buffering", "no").body(stream.subscribe());
    }

    @GetMapping
    public EventPageResponse list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) EventType eventType,
            @RequestParam(required = false) String reviewStatus,
            @RequestParam(required = false) String cameraId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long afterEventId) {
        return service.list(page, size, eventType, reviewStatus, cameraId, from, to, afterEventId);
    }

    @GetMapping("/latest-id")
    public java.util.Map<String, Long> latestEventId() {
        return java.util.Map.of("latestEventId", service.latestEventId());
    }

    @GetMapping("/{eventId}")
    public EventDetailResponse detail(@PathVariable Long eventId) { return service.detail(eventId); }

    @PostMapping("/{eventId}/response-complete")
    public EventDetailResponse completeResponse(@PathVariable Long eventId, Authentication authentication) {
        return service.completeResponse(eventId, authentication.getName());
    }

    @PostMapping("/{eventId}/report-timeout")
    public EventDetailResponse reportTimeout(@PathVariable Long eventId) {
        return service.reportTimeout(eventId);
    }

    @PatchMapping("/{eventId}/review")
    public EventDetailResponse review(@PathVariable Long eventId, Authentication authentication,
            @Valid @RequestBody ReviewEventRequest request) {
        return service.review(eventId, authentication.getName(), request);
    }
}
