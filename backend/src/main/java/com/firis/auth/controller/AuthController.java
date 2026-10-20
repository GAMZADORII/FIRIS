package com.firis.auth.controller;

import com.firis.auth.dto.ChangePasswordRequest;
import com.firis.auth.dto.CompleteContactOnboardingRequest;
import com.firis.auth.dto.ContactConsentVersionResponse;
import com.firis.auth.dto.ContactOnboardingResponse;
import com.firis.auth.dto.LoginRequest;
import com.firis.auth.dto.LoginResponse;
import com.firis.auth.service.AuthService;
import com.firis.common.dto.MessageResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PatchMapping("/password")
    public MessageResponse changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        return authService.changePassword(authentication.getName(), request);
    }

    @GetMapping("/contact-consent")
    public ContactConsentVersionResponse contactConsentVersion() {
        return authService.contactConsentVersion();
    }

    @PatchMapping("/contact")
    public ContactOnboardingResponse completeContactOnboarding(
            Authentication authentication,
            @Valid @RequestBody CompleteContactOnboardingRequest request
    ) {
        return authService.completeContactOnboarding(authentication.getName(), request);
    }

    @GetMapping("/contact")
    public ContactOnboardingResponse contact(Authentication authentication) {
        return authService.contact(authentication.getName());
    }
}
