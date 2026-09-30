package com.firis.account;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.firis.account.entity.Account;
import com.firis.account.entity.AccountStatus;
import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountAuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void cleanWorkers() {
        accountRepository.deleteAll(accountRepository.findAllByRoleOrderByAccountIdAsc(Role.WORKER));
    }

    @Test
    void serverStartupCreatesDefaultAdmin() {
        Account admin = accountRepository.findByLoginId("admin").orElseThrow();

        assertThat(admin.getRole()).isEqualTo(Role.ADMIN);
        assertThat(admin.getStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(admin.isMustChangePassword()).isFalse();
        assertThat(passwordEncoder.matches("admin1234", admin.getPasswordHash())).isTrue();
        assertThat(admin.getPasswordHash()).isNotEqualTo("admin1234");
    }

    @Test
    void adminLoginSucceeds() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"admin","password":"admin1234"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.account.loginId").value("admin"))
                .andExpect(jsonPath("$.account.role").value("ADMIN"))
                .andExpect(jsonPath("$.account.mustChangePassword").value(false));
    }

    @Test
    void wrongAdminPasswordIsRejected() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"admin","password":"wrong-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void adminCanCreateWorkerWithTemporaryPassword() throws Exception {
        String adminToken = loginAndGetToken("admin", "admin1234");

        mockMvc.perform(post("/api/admin/workers")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"테스트 작업자"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.loginId").value("W000001"))
                .andExpect(jsonPath("$.temporaryPassword").value("qwe123"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.mustChangePassword").value(true));
    }

    @Test
    void workerMustChangeInitialPasswordAndCanLoginWithNewPassword() throws Exception {
        String adminToken = loginAndGetToken("admin", "admin1234");
        createWorker(adminToken, "비밀번호 테스트");

        String workerToken = loginAndGetToken("W000001", "qwe123");

        mockMvc.perform(get("/api/admin/workers")
                        .header("Authorization", "Bearer " + workerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));

        mockMvc.perform(patch("/api/auth/password")
                        .header("Authorization", "Bearer " + workerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"qwe123","newPassword":"newpass123"}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"W000001","password":"qwe123"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"W000001","password":"newpass123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account.mustChangePassword").value(false));
    }

    @Test
    void inactiveWorkerCannotLogin() throws Exception {
        String adminToken = loginAndGetToken("admin", "admin1234");
        long workerId = createWorker(adminToken, "비활성 테스트");

        mockMvc.perform(patch("/api/admin/workers/{workerId}/status", workerId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"INACTIVE"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INACTIVE"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"W000001","password":"qwe123"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_INACTIVE"));
    }

    private String loginAndGetToken(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginBody(loginId, password))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("accessToken").asText();
    }

    private long createWorker(String adminToken, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/admin/workers")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new WorkerBody(name))))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("accountId").asLong();
    }

    private record LoginBody(String loginId, String password) {
    }

    private record WorkerBody(String name) {
    }
}
