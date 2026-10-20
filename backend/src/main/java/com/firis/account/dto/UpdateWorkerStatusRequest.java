package com.firis.account.dto;

import com.firis.account.entity.AccountStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateWorkerStatusRequest(
        @NotNull(message = "상태를 입력해주세요.")
        AccountStatus status
) {
}
