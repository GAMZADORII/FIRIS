package com.firis.common.dto;

public record ErrorResponse(
        String code,
        String message
) {
}
