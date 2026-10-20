package com.firis.report.controller;

import com.firis.event.controller.EventMediaController;
import com.firis.report.dto.Mock119CenterReportResponse;
import com.firis.report.entity.Mock119ResponseStatus;
import com.firis.report.service.Mock119CenterService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mock-119-center/reports")
@ConditionalOnProperty(name = "app.mock-119.center-enabled", havingValue = "true")
public class Mock119CenterController {
    private final Mock119CenterService center;
    private final EventMediaController media;
    public Mock119CenterController(Mock119CenterService center, EventMediaController media) {
        this.center = center; this.media = media;
    }
    public record StatusRequest(@NotNull Mock119ResponseStatus expectedStatus,
            @NotNull Mock119ResponseStatus responseStatus) {}
    @GetMapping public Page<Mock119CenterReportResponse> list(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "100") int size) {
        return center.list(page, size);
    }
    @GetMapping("/{id}") public Mock119CenterReportResponse detail(@PathVariable Long id) {
        return center.detail(id);
    }
    @PatchMapping("/{id}/response-status") public Mock119CenterReportResponse transition(
            @PathVariable Long id, @Valid @RequestBody StatusRequest request) {
        return center.transition(id, request.expectedStatus(), request.responseStatus());
    }
    @GetMapping(value = "/{id}/video", produces = "video/mp4")
    public ResponseEntity<Resource> video(@PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean annotated) {
        var eventId = center.eventId(id);
        return annotated ? media.annotatedVideo(eventId) : media.video(eventId);
    }
    @GetMapping(value = "/{id}/snapshot", produces = "image/jpeg")
    public ResponseEntity<Resource> snapshot(@PathVariable Long id) { return media.snapshot(center.eventId(id)); }
}
