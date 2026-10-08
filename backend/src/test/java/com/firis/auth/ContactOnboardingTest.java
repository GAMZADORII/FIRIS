package com.firis.auth;

import com.firis.account.entity.Account;
import com.firis.account.repository.AccountRepository;
import com.firis.auth.dto.ChangePasswordRequest;
import com.firis.auth.dto.CompleteContactOnboardingRequest;
import com.firis.auth.security.JwtTokenProvider;
import com.firis.auth.service.AuthService;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ContactOnboardingTest {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final AuthService auth = new AuthService(accounts, passwords, mock(JwtTokenProvider.class), "v1");
    private Account worker;

    @BeforeEach
    void setUp() {
        worker = Account.createWorker("W000001", passwords.encode("temporary"), "작업자");
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(worker));
    }

    @Test
    void firstLoginRequiresPasswordThenContactAndKeepsConsentAfterPasswordReset() {
        assertThat(worker.isContactOnboardingRequired()).isTrue();
        assertThatThrownBy(() -> auth.completeContactOnboarding("W000001",
                new CompleteContactOnboardingRequest("010-1234-5678", true, "v1")))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).getErrorCode())
                .isEqualTo(ErrorCode.PASSWORD_CHANGE_REQUIRED);

        auth.changePassword("W000001", new ChangePasswordRequest("temporary", "new-password"));
        assertThat(worker.isContactOnboardingRequired()).isTrue();

        var completed = auth.completeContactOnboarding("W000001",
                new CompleteContactOnboardingRequest("010-1234-5678", true, "v1"));
        assertThat(completed.contactOnboardingRequired()).isFalse();
        assertThat(completed.contactPhone()).isEqualTo("01012345678");
        assertThat(completed.consentVersion()).isEqualTo("v1");
        assertThat(completed.consentedAt()).isNotNull();

        worker.resetToTemporaryPassword(passwords.encode("another-temporary"));
        assertThat(worker.isMustChangePassword()).isTrue();
        assertThat(worker.isContactOnboardingRequired()).isFalse();
        assertThat(worker.getContactPhone()).isEqualTo("01012345678");
    }

    @Test
    void consentAndCurrentVersionAreRequiredWithoutSavingContact() {
        auth.changePassword("W000001", new ChangePasswordRequest("temporary", "new-password"));

        assertThatThrownBy(() -> auth.completeContactOnboarding("W000001",
                new CompleteContactOnboardingRequest("01012345678", false, "v1")))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> auth.completeContactOnboarding("W000001",
                new CompleteContactOnboardingRequest("01012345678", true, "old")))
                .isInstanceOf(ApiException.class);
        assertThat(worker.isContactOnboardingRequired()).isTrue();
        assertThat(worker.getContactPhone()).isNull();
    }

    @Test
    void completedWorkerCannotOverwriteOriginalConsent() {
        auth.changePassword("W000001", new ChangePasswordRequest("temporary", "new-password"));
        auth.completeContactOnboarding("W000001",
                new CompleteContactOnboardingRequest("01012345678", true, "v1"));

        assertThatThrownBy(() -> auth.completeContactOnboarding("W000001",
                new CompleteContactOnboardingRequest("01099999999", true, "v1")))
                .isInstanceOf(ApiException.class);
        assertThat(worker.getContactPhone()).isEqualTo("01012345678");
    }

    @Test
    void existingAccountsWithNullOnboardingFlagRemainUsable() {
        ReflectionTestUtils.setField(worker, "contactOnboardingRequired", null);
        assertThat(worker.isContactOnboardingRequired()).isFalse();
    }
}
