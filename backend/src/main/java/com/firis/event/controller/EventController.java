package com.firis.event.controller;

import com.firis.event.dto.*;
import com.firis.event.entity.EventType;
import com.firis.event.service.EventQueryService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/events")
public class EventController {
    private final EventQueryService service;
    public EventController(EventQueryService service) { this.service = service; }

    @GetMapping
    public EventPageResponse list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) EventType eventType,
            @RequestParam(required = false) String reviewStatus,
            @RequestParam(required = false) String cameraId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(page, size, eventType, reviewStatus, cameraId, from, to);
    }

    @GetMapping("/{eventId}")
    public EventDetailResponse detail(@PathVariable Long eventId) { return service.detail(eventId); }

    @PatchMapping("/{eventId}/review")
    public EventDetailResponse review(@PathVariable Long eventId, Authentication authentication,
            @Valid @RequestBody ReviewEventRequest request) {
        return service.review(eventId, authentication.getName(), request);
    }
}
