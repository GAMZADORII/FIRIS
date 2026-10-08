package com.firis.auth.dto;

import com.firis.account.entity.Account;
import com.firis.account.entity.Role;

public record LoginAccountResponse(
        Long accountId,
        String loginId,
        String name,
        Role role,
        boolean mustChangePassword,
        boolean contactOnboardingRequired
) {
    public static LoginAccountResponse from(Account account) {
        return new LoginAccountResponse(
                account.getAccountId(),
                account.getLoginId(),
                account.getName(),
                account.getRole(),
                account.isMustChangePassword(),
                account.isContactOnboardingRequired()
        );
    }
}
