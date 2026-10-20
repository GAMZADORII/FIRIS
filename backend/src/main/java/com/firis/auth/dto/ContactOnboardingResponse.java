package com.firis.auth.dto;

import java.time.LocalDateTime;

public record ContactOnboardingResponse(
        boolean contactOnboardingRequired,
        String contactPhone,
        String consentVersion,
        LocalDateTime consentedAt
) {
}
