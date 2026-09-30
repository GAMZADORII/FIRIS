package com.firis.account.dto;

import com.firis.account.entity.AccountStatus;

public record CreateWorkerResponse(
        Long accountId,
        String loginId,
        String name,
        String temporaryPassword,
        AccountStatus status,
        boolean mustChangePassword
) {
}
