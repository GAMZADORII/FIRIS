package com.firis.account.config;

import com.firis.account.repository.AccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AdminAccountInitializerTest {
    @Test void existingDefaultIdIsPreservedEvenAfterAuthorizedDemotion() {
        var accounts = mock(AccountRepository.class);
        var passwords = mock(PasswordEncoder.class);
        when(accounts.existsByLoginId("admin")).thenReturn(true);
        new AdminAccountInitializer(accounts, passwords, "admin", "default-password", "관리자").run(null);
        verify(accounts, never()).save(any());
        verifyNoInteractions(passwords);
    }
}
