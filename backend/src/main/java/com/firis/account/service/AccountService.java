package com.firis.account.service;

import com.firis.account.dto.CreateWorkerRequest;
import com.firis.account.dto.AccountRoleCountsResponse;
import com.firis.account.dto.CreateWorkerResponse;
import com.firis.account.dto.ResetPasswordResponse;
import com.firis.account.dto.UpdateWorkerStatusRequest;
import com.firis.account.dto.UpdateAccountRoleRequest;
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
            @Value("${app.worker.default-password}") String defaultWorkerPassword
    ) {
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.defaultWorkerPassword = defaultWorkerPassword;
    }

    @Transactional
    public synchronized CreateWorkerResponse createWorker(CreateWorkerRequest request) {
        requireDefaultWorkerPassword();
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
    public AccountRoleCountsResponse getRoleCounts() {
        return new AccountRoleCountsResponse(
                accountRepository.countByRole(Role.SUPER_ADMIN),
                accountRepository.countByRole(Role.ADMIN),
                accountRepository.countByRole(Role.WORKER));
    }

    @Transactional(readOnly = true)
    public List<WorkerResponse> getWorkers(String actorLoginId) {
        var actor = requireManager(actorLoginId);
        var roles = actor.getRole() == Role.SUPER_ADMIN ? List.of(Role.ADMIN, Role.WORKER) : List.of(Role.WORKER);
        return accountRepository.findAllByRoleInOrderByAccountIdAsc(roles).stream()
                .map(WorkerResponse::from)
                .toList();
    }

    @Transactional
    public WorkerStatusResponse changeWorkerStatus(Long workerId, UpdateWorkerStatusRequest request, String actorLoginId) {
        Account worker = findManageableAccount(workerId, requireManager(actorLoginId));
        worker.changeStatus(request.status());
        return new WorkerStatusResponse(worker.getAccountId(), worker.getStatus());
    }

    @Transactional
    public ResetPasswordResponse resetWorkerPassword(Long workerId, String actorLoginId) {
        requireDefaultWorkerPassword();
        Account worker = findManageableAccount(workerId, requireManager(actorLoginId));
        worker.resetToTemporaryPassword(passwordEncoder.encode(defaultWorkerPassword));

        return new ResetPasswordResponse(
                worker.getLoginId(),
                defaultWorkerPassword,
                true,
                "비밀번호가 초기화되었습니다."
        );
    }

    @Transactional
    public void deleteAccount(Long accountId, String actorLoginId) {
        findManageableAccount(accountId, requireManager(actorLoginId)).delete();
    }

    private void requireDefaultWorkerPassword() {
        if (defaultWorkerPassword == null || defaultWorkerPassword.isBlank()) {
            throw new IllegalStateException("WORKER_DEFAULT_PASSWORD 환경변수를 설정해야 합니다.");
        }
    }

    @Transactional
    public WorkerResponse changeAccountRole(Long accountId, UpdateAccountRoleRequest request, String actorLoginId) {
        var actor = requireManager(actorLoginId);
        if (actor.getRole() != Role.SUPER_ADMIN) throw new ApiException(ErrorCode.FORBIDDEN);
        if (request.role() == Role.SUPER_ADMIN) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "작업자 또는 관리자 권한만 지정할 수 있습니다.");
        }
        var target = findManageableAccount(accountId, actor);
        if (target.getRole() != request.expectedRole()) {
            throw new ApiException(ErrorCode.ACCOUNT_ROLE_CONFLICT);
        }
        target.changeRole(request.role());
        return WorkerResponse.from(target);
    }

    private Account requireManager(String loginId) {
        var actor = accountRepository.findByLoginId(loginId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        if (!actor.isActive() || !actor.getRole().isAdministrator()) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        return actor;
    }

    private Account findManageableAccount(Long accountId, Account actor) {
        var target = accountRepository.findForManagement(accountId)
                .orElseThrow(() -> new ApiException(ErrorCode.ACCOUNT_NOT_FOUND));
        if (target.isDeleted()) throw new ApiException(ErrorCode.ACCOUNT_NOT_FOUND);
        if (target.getRole() == Role.SUPER_ADMIN
                || (target.getRole() == Role.ADMIN && actor.getRole() != Role.SUPER_ADMIN)) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        return target;
    }

    private String generateNextWorkerLoginId() {
        int currentMax = accountRepository.findWorkerLoginIds().stream()
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
