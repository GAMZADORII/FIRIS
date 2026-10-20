package com.firis.account.config;

import com.firis.account.entity.Account;
import com.firis.account.entity.AccountStatus;
import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SuperAdminAccountInitializerTest {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final SuperAdminAccountInitializer initializer = new SuperAdminAccountInitializer(accounts, passwords, "1234", "010-1234-5678");

    @Test void createsOnlyMissingAccountAndPreservesChangedExistingAccount() {
        var existing = Account.createSuperAdmin("superadmin1", "changed-hash", "변경된 이름");
        existing.changeStatus(AccountStatus.INACTIVE);
        existing.fillMissingContactPhone("010-9999-8888");
        when(accounts.findByLoginId("superadmin1")).thenReturn(Optional.of(existing));
        when(passwords.encode("1234")).thenReturn("bcrypt-hash");
        initializer.run(null);
        verify(accounts).saveAndFlush(argThat(account -> account.getLoginId().equals("superadmin2")
                && account.getRole() == Role.SUPER_ADMIN && account.getName().equals("차나래")
                && account.getPasswordHash().equals("bcrypt-hash")));
        assertThat(existing.getPasswordHash()).isEqualTo("changed-hash");
        assertThat(existing.getName()).isEqualTo("변경된 이름");
        assertThat(existing.getStatus()).isEqualTo(AccountStatus.INACTIVE);
        assertThat(existing.getContactPhone()).isEqualTo("01099998888");
    }

    @Test void existingBlankPhoneIsBackfilledWithoutInventingConsent() {
        var first = Account.createSuperAdmin("superadmin1", "unchanged-hash", "박상현");
        var second = Account.createSuperAdmin("superadmin2", "unchanged-hash", "차나래");
        when(accounts.findByLoginId("superadmin1")).thenReturn(Optional.of(first));
        when(accounts.findByLoginId("superadmin2")).thenReturn(Optional.of(second));
        initializer.run(null);
        assertThat(first.getContactPhone()).isEqualTo("01012345678");
        assertThat(second.getContactPhone()).isEqualTo("01012345678");
        assertThat(first.getPasswordHash()).isEqualTo("unchanged-hash");
        assertThat(first.getContactConsentVersion()).isNull();
        assertThat(first.getContactConsentedAt()).isNull();
        verify(accounts).saveAndFlush(first);
        verify(accounts).saveAndFlush(second);
        verifyNoInteractions(passwords);
    }

    @Test void conflictingLoginIdNeverChangesAnExistingRole() {
        var existing = Account.createAdmin("superadmin1", "hash", "기존 관리자");
        when(accounts.findByLoginId("superadmin1")).thenReturn(Optional.of(existing));
        assertThatThrownBy(() -> initializer.run(null)).isInstanceOf(IllegalStateException.class);
        assertThat(existing.getRole()).isEqualTo(Role.ADMIN);
        verify(accounts, never()).saveAndFlush(any());
        verifyNoInteractions(passwords);
    }

    @Test void duplicateConcurrentInsertIsPreservedWithoutResettingPassword() {
        var existing = Account.createSuperAdmin("superadmin1", "other-hash", "박상현");
        when(accounts.findByLoginId("superadmin1")).thenReturn(Optional.empty(), Optional.of(existing));
        var second = Account.createSuperAdmin("superadmin2", "hash", "차나래");
        second.fillMissingContactPhone("010-7777-8888");
        when(accounts.findByLoginId("superadmin2")).thenReturn(Optional.of(second));
        when(accounts.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate"));
        assertThatCode(() -> initializer.run(null)).doesNotThrowAnyException();
        assertThat(existing.getPasswordHash()).isEqualTo("other-hash");
    }

    @Test void initializationCanBeDisabled() {
        new ApplicationContextRunner().withUserConfiguration(SuperAdminAccountInitializer.class)
                .withPropertyValues("app.super-admin.enabled=false")
                .run(context -> assertThat(context).doesNotHaveBean(SuperAdminAccountInitializer.class));
    }

    @Test void blankPasswordCannotCreateAccounts() {
        assertThatThrownBy(() -> new SuperAdminAccountInitializer(accounts, passwords, " ", "010-1234-5678").run(null))
                .isInstanceOf(IllegalStateException.class);
        verify(accounts, never()).saveAndFlush(any());
    }
}
