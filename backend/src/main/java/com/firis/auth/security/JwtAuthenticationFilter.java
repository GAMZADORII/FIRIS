package com.firis.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.firis.account.entity.Account;
import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import com.firis.common.dto.ErrorResponse;
import com.firis.common.exception.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final AccountRepository accountRepository;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(
            JwtTokenProvider jwtTokenProvider,
            AccountRepository accountRepository,
            ObjectMapper objectMapper
    ) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.accountRepository = accountRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return ("POST".equalsIgnoreCase(request.getMethod()) && "/api/auth/login".equals(uri))
                || ("GET".equalsIgnoreCase(request.getMethod()) && "/api/health".equals(uri));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String token = resolveToken(request);
        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        JwtTokenProvider.ValidationResult validationResult = jwtTokenProvider.validate(token);
        if (validationResult == JwtTokenProvider.ValidationResult.EXPIRED) {
            writeError(response, ErrorCode.UNAUTHORIZED, "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.");
            return;
        }
        if (validationResult == JwtTokenProvider.ValidationResult.INVALID) {
            writeError(response, ErrorCode.UNAUTHORIZED, "유효하지 않은 인증 정보입니다.");
            return;
        }

        String loginId = jwtTokenProvider.getLoginId(token);
        Account account = accountRepository.findByLoginId(loginId).orElse(null);
        if (account == null) {
            writeError(response, ErrorCode.UNAUTHORIZED, "유효하지 않은 인증 정보입니다.");
            return;
        }
        if (!account.isActive()) {
            writeError(response, ErrorCode.ACCOUNT_INACTIVE, ErrorCode.ACCOUNT_INACTIVE.getMessage());
            return;
        }
        if (account.getRole() == Role.WORKER
                && account.isMustChangePassword()
                && !isPasswordChangeRequest(request)
                && !isContactConsentRead(request)) {
            writeError(
                    response,
                    ErrorCode.PASSWORD_CHANGE_REQUIRED,
                    ErrorCode.PASSWORD_CHANGE_REQUIRED.getMessage()
            );
            return;
        }
        if (account.getRole() == Role.WORKER
                && account.isContactOnboardingRequired()
                && !isPasswordChangeRequest(request)
                && !isContactOnboardingRequest(request)
                && !isContactRead(request)
                && !isContactConsentRead(request)) {
            writeError(
                    response,
                    ErrorCode.CONTACT_ONBOARDING_REQUIRED,
                    ErrorCode.CONTACT_ONBOARDING_REQUIRED.getMessage()
            );
            return;
        }

        var authentication = new UsernamePasswordAuthenticationToken(
                account.getLoginId(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + account.getRole().name()))
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }

    private boolean isPasswordChangeRequest(HttpServletRequest request) {
        return "PATCH".equalsIgnoreCase(request.getMethod())
                && "/api/auth/password".equals(request.getRequestURI());
    }

    private boolean isContactOnboardingRequest(HttpServletRequest request) {
        return "PATCH".equalsIgnoreCase(request.getMethod())
                && "/api/auth/contact".equals(request.getRequestURI());
    }

    private boolean isContactConsentRead(HttpServletRequest request) {
        return "GET".equalsIgnoreCase(request.getMethod())
                && "/api/auth/contact-consent".equals(request.getRequestURI());
    }

    private boolean isContactRead(HttpServletRequest request) {
        return "GET".equalsIgnoreCase(request.getMethod())
                && "/api/auth/contact".equals(request.getRequestURI());
    }

    private String resolveToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        String token = authorization.substring(7).trim();
        return token.isBlank() ? null : token;
    }

    private void writeError(HttpServletResponse response, ErrorCode errorCode, String message) throws IOException {
        response.setStatus(errorCode.getStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), new ErrorResponse(errorCode.name(), message));
    }
}
