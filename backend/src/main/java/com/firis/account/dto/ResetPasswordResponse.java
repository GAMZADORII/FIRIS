package com.firis.account.dto;

public record ResetPasswordResponse(
        String loginId,
        String temporaryPassword,
        boolean mustChangePassword,
        String message
) {
}
