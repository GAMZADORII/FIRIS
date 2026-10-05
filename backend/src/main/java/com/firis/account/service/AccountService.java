package com.firis.account.service;

import com.firis.account.dto.CreateWorkerRequest;
import com.firis.account.dto.CreateWorkerResponse;
import com.firis.account.dto.ResetPasswordResponse;
import com.firis.account.dto.UpdateWorkerStatusRequest;
import com.firis.account.dto.WorkerResponse;
import com.firis.account.dto.WorkerStatusResponse;
import com.firis.account.entity.Account;
import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AccountService {

    private static final String WORKER_PREFIX = "W";
    private static final int WORKER_NUMBER_WIDTH = 6;
    private static final int MAX_WORKER_NUMBER = 999_999;

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final String defaultWorkerPassword;

    public AccountService(
            AccountRepository accountRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.worker.default-password:qwe123}") String defaultWorkerPassword
    ) {
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.defaultWorkerPassword = defaultWorkerPassword;
    }

    @Transactional
    public synchronized CreateWorkerResponse createWorker(CreateWorkerRequest request) {
        String loginId = generateNextWorkerLoginId();

        Account worker = Account.createWorker(
                loginId,
                passwordEncoder.encode(defaultWorkerPassword),
                request.name().trim()
        );
        Account saved = accountRepository.save(worker);

        return new CreateWorkerResponse(
                saved.getAccountId(),
                saved.getLoginId(),
                saved.getName(),
                defaultWorkerPassword,
                saved.getStatus(),
                saved.isMustChangePassword()
        );
    }

    @Transactional(readOnly = true)
    public List<WorkerResponse> getWorkers() {
        return accountRepository.findAllByRoleOrderByAccountIdAsc(Role.WORKER).stream()
                .map(WorkerResponse::from)
                .toList();
    }

    @Transactional
    public WorkerStatusResponse changeWorkerStatus(Long workerId, UpdateWorkerStatusRequest request) {
        Account worker = findWorker(workerId);
        worker.changeStatus(request.status());
        return new WorkerStatusResponse(worker.getAccountId(), worker.getStatus());
    }

    @Transactional
    public ResetPasswordResponse resetWorkerPassword(Long workerId) {
        Account worker = findWorker(workerId);
        worker.resetToTemporaryPassword(passwordEncoder.encode(defaultWorkerPassword));

        return new ResetPasswordResponse(
                worker.getLoginId(),
                defaultWorkerPassword,
                true,
                "비밀번호가 초기화되었습니다."
        );
    }

    private Account findWorker(Long workerId) {
        return accountRepository.findById(workerId)
                .filter(account -> account.getRole() == Role.WORKER)
                .orElseThrow(() -> new ApiException(ErrorCode.WORKER_NOT_FOUND));
    }

    private String generateNextWorkerLoginId() {
        int currentMax = accountRepository.findAllByRoleOrderByAccountIdAsc(Role.WORKER).stream()
                .map(Account::getLoginId)
                .filter(loginId -> loginId != null && loginId.matches("^W\\d{6}$"))
                .map(loginId -> loginId.substring(1))
                .mapToInt(Integer::parseInt)
                .max()
                .orElse(0);

        int next = currentMax + 1;
        if (next > MAX_WORKER_NUMBER) {
            throw new ApiException(ErrorCode.INTERNAL_SERVER_ERROR, "작업자 로그인 ID 발급 한도를 초과했습니다.");
        }

        String loginId = WORKER_PREFIX + String.format("%0" + WORKER_NUMBER_WIDTH + "d", next);
        if (accountRepository.existsByLoginId(loginId)) {
            throw new ApiException(ErrorCode.INTERNAL_SERVER_ERROR, "작업자 로그인 ID 생성 중 중복이 발생했습니다.");
        }
        return loginId;
    }
}
