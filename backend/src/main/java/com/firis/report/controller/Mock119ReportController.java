package com.firis.report.controller;

import com.firis.report.dto.Mock119ReportResponse;
import com.firis.report.dto.Mock119PreviewResponse;
import com.firis.report.service.Mock119ReportService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/events/{eventId}")
public class Mock119ReportController {
    private final Mock119ReportService service;

    public Mock119ReportController(Mock119ReportService service) { this.service = service; }

    @GetMapping("/mock-119-preview")
    public Mock119PreviewResponse preview(@PathVariable Long eventId, Authentication authentication) {
        return service.preview(eventId, authentication.getName());
    }

    @PostMapping("/mock-119-reports")
    public Mock119ReportResponse report(@PathVariable Long eventId, Authentication authentication) {
        return service.report(eventId, authentication.getName());
    }

    @GetMapping("/mock-119-report")
    public Mock119ReportResponse status(@PathVariable Long eventId) {
        return service.status(eventId);
    }
}
