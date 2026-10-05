package com.firis.auth.dto;

public record LoginResponse(
        String accessToken,
        LoginAccountResponse account
) {
}
