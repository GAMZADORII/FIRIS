package com.firis.account.config;

import com.firis.account.entity.Account;
import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AdminAccountInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminAccountInitializer.class);

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminLoginId;
    private final String adminPassword;
    private final String adminName;

    public AdminAccountInitializer(
            AccountRepository accountRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.login-id:admin}") String adminLoginId,
            @Value("${app.admin.password:firis1234!}") String adminPassword,
            @Value("${app.admin.name:관리자}") String adminName
    ) {
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminLoginId = adminLoginId;
        this.adminPassword = adminPassword;
        this.adminName = adminName;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (accountRepository.existsByRole(Role.ADMIN)) {
            log.info("관리자 계정이 이미 존재하여 초기 생성을 건너뜁니다.");
            return;
        }

        if (accountRepository.existsByLoginId(adminLoginId)) {
            throw new IllegalStateException(
                    "초기 관리자 로그인 ID '" + adminLoginId + "'가 이미 다른 계정에서 사용 중입니다."
            );
        }

        Account admin = Account.createAdmin(
                adminLoginId,
                passwordEncoder.encode(adminPassword),
                adminName
        );
        accountRepository.save(admin);

        log.info("초기 관리자 계정이 생성되었습니다. loginId={}", adminLoginId);
    }
}
