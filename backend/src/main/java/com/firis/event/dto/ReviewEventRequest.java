package com.firis.event.dto;

import com.firis.event.entity.FalsePositiveReason;
import com.firis.event.entity.ReviewResult;
import jakarta.validation.constraints.Size;

public record ReviewEventRequest(
        ReviewResult result,
        FalsePositiveReason falsePositiveReason,
        @Size(max = 500) String note
) {}
