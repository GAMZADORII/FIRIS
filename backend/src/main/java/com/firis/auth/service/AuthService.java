package com.firis.auth.service;

import com.firis.account.entity.Account;
import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import com.firis.auth.dto.ChangePasswordRequest;
import com.firis.auth.dto.LoginAccountResponse;
import com.firis.auth.dto.LoginRequest;
import com.firis.auth.dto.LoginResponse;
import com.firis.auth.security.JwtTokenProvider;
import com.firis.common.dto.MessageResponse;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(
            AccountRepository accountRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider
    ) {
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
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
}
