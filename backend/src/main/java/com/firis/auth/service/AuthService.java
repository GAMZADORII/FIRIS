package com.firis.auth.service;

import com.firis.account.entity.Account;
import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import com.firis.auth.dto.ChangePasswordRequest;
import com.firis.auth.dto.CompleteContactOnboardingRequest;
import com.firis.auth.dto.ContactConsentVersionResponse;
import com.firis.auth.dto.ContactOnboardingResponse;
import com.firis.auth.dto.LoginAccountResponse;
import com.firis.auth.dto.LoginRequest;
import com.firis.auth.dto.LoginResponse;
import com.firis.auth.security.JwtTokenProvider;
import com.firis.common.dto.MessageResponse;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service
public class AuthService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final String contactConsentVersion;

    public AuthService(
            AccountRepository accountRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            @Value("${app.contact-consent.version:v1}") String contactConsentVersion
    ) {
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.contactConsentVersion = contactConsentVersion;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        Account account = accountRepository.findByLoginId(request.loginId())
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS));

        if (!passwordEncoder.matches(request.password(), account.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
        }
        if (!account.isActive()) {
            throw new ApiException(ErrorCode.ACCOUNT_INACTIVE);
        }

        String token = jwtTokenProvider.generateToken(account);
        return new LoginResponse(token, LoginAccountResponse.from(account));
    }

    @Transactional
    public MessageResponse changePassword(String loginId, ChangePasswordRequest request) {
        Account account = accountRepository.findByLoginId(loginId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));

        if (account.getRole() != Role.WORKER) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        if (!passwordEncoder.matches(request.currentPassword(), account.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_CURRENT_PASSWORD);
        }
        if (passwordEncoder.matches(request.newPassword(), account.getPasswordHash())) {
            throw new ApiException(ErrorCode.SAME_PASSWORD);
        }

        account.changePassword(passwordEncoder.encode(request.newPassword()));
        return new MessageResponse("비밀번호가 변경되었습니다.");
    }

    public ContactConsentVersionResponse contactConsentVersion() {
        return new ContactConsentVersionResponse(contactConsentVersion);
    }

    @Transactional(readOnly = true)
    public ContactOnboardingResponse contact(String loginId) {
        Account account = accountRepository.findByLoginId(loginId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        if (account.getRole() != Role.WORKER) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        return new ContactOnboardingResponse(
                account.isContactOnboardingRequired(), account.getContactPhone(),
                account.getContactConsentVersion(), account.getContactConsentedAt()
        );
    }

    @Transactional
    public ContactOnboardingResponse completeContactOnboarding(
            String loginId, CompleteContactOnboardingRequest request
    ) {
        Account account = accountRepository.findByLoginId(loginId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        if (account.getRole() != Role.WORKER) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        if (account.isMustChangePassword()) {
            throw new ApiException(ErrorCode.PASSWORD_CHANGE_REQUIRED);
        }
        if (!account.isContactOnboardingRequired() && account.getContactPhone() != null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "이미 최초 연락처 등록을 완료했습니다.");
        }
        if (!Boolean.TRUE.equals(request.consentAccepted())) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "개인정보 수집·이용 동의가 필요합니다.");
        }
        if (!contactConsentVersion.equals(request.consentVersion())) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "동의 문안이 변경되었습니다. 내용을 다시 확인해주세요.");
        }
        String phone = request.contactPhone();
        if (phone == null || !phone.matches("^0\\d{1,2}-?\\d{3,4}-?\\d{4}$")) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "올바른 연락처를 입력해주세요.");
        }
        account.completeContactOnboarding(phone.replace("-", ""), contactConsentVersion, LocalDateTime.now());
        return new ContactOnboardingResponse(
                false, account.getContactPhone(), account.getContactConsentVersion(), account.getContactConsentedAt()
        );
    }
}
