package com.firis.account.controller;

import com.firis.account.dto.CreateWorkerRequest;
import com.firis.account.dto.CreateWorkerResponse;
import com.firis.account.dto.ResetPasswordResponse;
import com.firis.account.dto.UpdateWorkerStatusRequest;
import com.firis.account.dto.WorkerResponse;
import com.firis.account.dto.WorkerStatusResponse;
import com.firis.account.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import com.firis.account.dto.UpdateAccountRoleRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/workers")
public class AdminAccountController {

    private final AccountService accountService;

    public AdminAccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping
    public List<WorkerResponse> getWorkers(Authentication authentication) {
        return accountService.getWorkers(authentication.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CreateWorkerResponse createWorker(@Valid @RequestBody CreateWorkerRequest request) {
        return accountService.createWorker(request);
    }

    @DeleteMapping("/{workerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@PathVariable Long workerId, Authentication authentication) {
        accountService.deleteAccount(workerId, authentication.getName());
    }

    @PatchMapping("/{workerId}/status")
    public WorkerStatusResponse changeWorkerStatus(
            @PathVariable Long workerId,
            @Valid @RequestBody UpdateWorkerStatusRequest request,
            Authentication authentication
    ) {
        return accountService.changeWorkerStatus(workerId, request, authentication.getName());
    }

    @PatchMapping("/{workerId}/role")
    public WorkerResponse changeRole(@PathVariable Long workerId,
            @Valid @RequestBody UpdateAccountRoleRequest request, Authentication authentication) {
        return accountService.changeAccountRole(workerId, request, authentication.getName());
    }

    @PatchMapping("/{workerId}/password-reset")
    public ResetPasswordResponse resetWorkerPassword(@PathVariable Long workerId, Authentication authentication) {
        return accountService.resetWorkerPassword(workerId, authentication.getName());
    }
}
