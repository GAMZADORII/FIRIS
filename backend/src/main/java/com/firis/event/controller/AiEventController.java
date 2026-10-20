package com.firis.event.controller;

import com.firis.event.dto.*;
import com.firis.event.service.AiEventService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai/events")
public class AiEventController {
    private final AiEventService service;
    public AiEventController(AiEventService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CreateAiEventResponse create(@Valid @RequestBody CreateAiEventRequest request) {
        return service.create(request);
    }
    @PatchMapping("/{eventId}/media")
    public UpdateAiMediaResponse update(@PathVariable Long eventId, @Valid @RequestBody UpdateAiMediaRequest request) {
        return service.updateMedia(eventId, request);
    }
}
