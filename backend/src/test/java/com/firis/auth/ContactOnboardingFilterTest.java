package com.firis.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.firis.account.entity.Account;
import com.firis.account.repository.AccountRepository;
import com.firis.auth.security.JwtAuthenticationFilter;
import com.firis.auth.security.JwtTokenProvider;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ContactOnboardingFilterTest {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final JwtTokenProvider tokens = mock(JwtTokenProvider.class);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokens, accounts, new ObjectMapper(), true);

    @Test
    void unfinishedWorkerCanOnlyUseOnboardingEndpoints() throws Exception {
        Account worker = Account.createWorker("W000001", "hash", "작업자");
        worker.changePassword("changed-hash");
        when(tokens.validate("valid-token")).thenReturn(JwtTokenProvider.ValidationResult.VALID);
        when(tokens.getLoginId("valid-token")).thenReturn("W000001");
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(worker));

        var deniedRequest = request("GET", "/api/cameras");
        var deniedResponse = new MockHttpServletResponse();
        filter.doFilter(deniedRequest, deniedResponse, new MockFilterChain());
        assertThat(deniedResponse.getStatus()).isEqualTo(403);
        assertThat(deniedResponse.getContentAsString()).contains("CONTACT_ONBOARDING_REQUIRED");

        var contactRequest = request("PATCH", "/api/auth/contact");
        var contactResponse = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        filter.doFilter(contactRequest, contactResponse, chain);
        assertThat(chain.getRequest()).isSameAs(contactRequest);
        assertThat(contactResponse.getStatus()).isEqualTo(200);
    }

    @Test
    void unfinishedWorkerCanUseExistingDashboardBeforeFrontendOnboardingIsReady() throws Exception {
        Account worker = Account.createWorker("W000001", "hash", "작업자");
        worker.changePassword("changed-hash");
        when(tokens.validate("valid-token")).thenReturn(JwtTokenProvider.ValidationResult.VALID);
        when(tokens.getLoginId("valid-token")).thenReturn("W000001");
        when(accounts.findByLoginId("W000001")).thenReturn(Optional.of(worker));
        var rolloutFilter = new JwtAuthenticationFilter(tokens, accounts, new ObjectMapper(), false);
        var request = request("GET", "/api/cameras");
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();

        rolloutFilter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isSameAs(request);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    private MockHttpServletRequest request(String method, String path) {
        var request = new MockHttpServletRequest(method, path);
        request.addHeader("Authorization", "Bearer valid-token");
        return request;
    }
}
