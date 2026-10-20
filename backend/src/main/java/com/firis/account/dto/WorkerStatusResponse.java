package com.firis.account.dto;

import com.firis.account.entity.AccountStatus;

public record WorkerStatusResponse(
        Long accountId,
        AccountStatus status
) {
}
