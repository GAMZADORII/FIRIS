package com.firis.account.dto;

import com.firis.account.entity.Account;
import com.firis.account.entity.AccountStatus;
import com.firis.account.entity.Role;

import java.time.LocalDateTime;

public record WorkerResponse(
        Long accountId,
        String loginId,
        String name,
        AccountStatus status,
        boolean mustChangePassword,
        LocalDateTime createdAt,
        String contactPhone,
        Role role
) {
    public static WorkerResponse from(Account account) {
        return new WorkerResponse(
                account.getAccountId(),
                account.getLoginId(),
                account.getName(),
                account.getStatus(),
                account.isMustChangePassword(),
                account.getCreatedAt().withNano(0),
                account.getContactPhone(),
                account.getRole()
        );
    }
}
