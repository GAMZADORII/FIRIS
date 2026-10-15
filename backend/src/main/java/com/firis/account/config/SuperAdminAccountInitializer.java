package com.firis.account.config;

import com.firis.account.entity.Account;
import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.super-admin", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SuperAdminAccountInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SuperAdminAccountInitializer.class);
    private final AccountRepository accounts;
    private final PasswordEncoder passwords;
    private final String initialPassword;
    private final String initialContactPhone;

    public SuperAdminAccountInitializer(AccountRepository accounts, PasswordEncoder passwords,
            @Value("${app.super-admin.password:1234}") String initialPassword,
            @Value("${app.super-admin.contact-phone:010-1234-5678}") String initialContactPhone) {
        this.accounts = accounts;
        this.passwords = passwords;
        this.initialPassword = initialPassword;
        this.initialContactPhone = initialContactPhone;
    }

    @Override
    public void run(ApplicationArguments args) {
        createIfMissing("superadmin1", "박상현");
        createIfMissing("superadmin2", "차나래");
    }

    private void createIfMissing(String loginId, String name) {
        var existing = accounts.findByLoginId(loginId);
        if (existing.isPresent()) {
            requireSuperAdmin(existing.get());
            if (existing.get().fillMissingContactPhone(initialContactPhone)) {
                accounts.saveAndFlush(existing.get());
            }
            return;
        }
        if (initialPassword == null || initialPassword.isBlank()) {
            throw new IllegalStateException("기본 최고 관리자 생성에 필요한 SUPER_ADMIN_PASSWORD가 비어 있습니다.");
        }
        try {
            // Each repository call has its own transaction: a duplicate insert may be retried safely.
            var account = Account.createSuperAdmin(loginId, passwords.encode(initialPassword), name);
            account.fillMissingContactPhone(initialContactPhone);
            accounts.saveAndFlush(account);
        } catch (DataIntegrityViolationException exception) {
            var concurrent = accounts.findByLoginId(loginId);
            if (concurrent.isEmpty()) throw exception;
            requireSuperAdmin(concurrent.get());
            return;
        }
        log.info("기본 최고 관리자 계정이 생성되었습니다. loginId={}", loginId);
    }

    private void requireSuperAdmin(Account account) {
        if (account.getRole() != Role.SUPER_ADMIN) {
            throw new IllegalStateException("기본 최고 관리자 ID '" + account.getLoginId()
                    + "'가 다른 권한의 계정에서 사용 중입니다. 기존 계정은 변경하지 않습니다.");
        }
    }
}
