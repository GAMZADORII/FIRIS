package com.firis.event.dto;

import java.util.List;
import org.springframework.data.domain.Page;

public record EventPageResponse(List<EventSummaryResponse> content, long totalElements,
        int totalPages, int number, int size) {
    public static EventPageResponse from(Page<EventSummaryResponse> page) {
        return new EventPageResponse(page.getContent(), page.getTotalElements(),
                page.getTotalPages(), page.getNumber(), page.getSize());
    }
}
