package com.firis.account.controller;

import com.firis.account.dto.AccountRoleCountsResponse;
import com.firis.account.service.AccountService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/accounts")
public class AdminAccountStatisticsController {
    private final AccountService accounts;

    public AdminAccountStatisticsController(AccountService accounts) {
        this.accounts = accounts;
    }

    @GetMapping("/role-counts")
    public AccountRoleCountsResponse getRoleCounts() {
        return accounts.getRoleCounts();
    }
}
