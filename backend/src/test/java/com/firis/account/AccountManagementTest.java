package com.firis.account;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.firis.account.entity.Account;
import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import com.firis.auth.security.JwtTokenProvider;
import java.net.URI;
import java.net.http.*;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:accountmanagement;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.config.import=", "security.jwt.secret=unit-test-only-secret-0123456789-abcdef",
    "app.admin.password=", "app.worker.default-password=temporary1234",
    "app.contact-consent.enforce-onboarding=false", "AI_API_KEY=test-only-ai-key"
})
class AccountManagementTest {
    @LocalServerPort int port;
    @Autowired AccountRepository accounts;
    @Autowired JwtTokenProvider tokens;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper mapper;
    private final HttpClient http = HttpClient.newHttpClient();

    @Test void highestAdministratorSeesAdministratorsAndWorkersWhileAdministratorSeesOnlyWorkers() throws Exception {
        var admin = accounts.saveAndFlush(Account.createAdmin("list-admin", "hash", "목록 관리자"));
        var worker = worker("list-worker", false);
        var superResponse = call("GET", "/api/admin/workers", highestToken(), null);
        assertThat(superResponse.statusCode()).isEqualTo(200);
        var all = json(superResponse);
        assertThat(all.toString()).contains("list-admin", "list-worker");
        for (var account : all) assertThat(account.path("role").asText()).isIn("ADMIN", "WORKER");
        var adminResponse = call("GET", "/api/admin/workers", tokens.generateToken(admin), null);
        assertThat(adminResponse.statusCode()).isEqualTo(200);
        var workers = json(adminResponse);
        assertThat(workers.toString()).contains("list-worker").doesNotContain("list-admin");
        for (var account : workers) assertThat(account.path("role").asText()).isEqualTo("WORKER");
        assertThat(call("GET", "/api/admin/workers", tokens.generateToken(worker), null).statusCode()).isEqualTo(403);
    }

    @Test void roleChangesPreserveIdentityAndImmediatelyAffectPreviouslyIssuedTokens() throws Exception {
        var account = worker("W800000", false);
        var id = account.getAccountId();
        var created = accounts.findById(id).orElseThrow().getCreatedAt();
        var oldToken = tokens.generateToken(account);
        assertThat(changeRole(id, "ADMIN", "WORKER", highestToken()).statusCode()).isEqualTo(200);
        var promoted = accounts.findById(id).orElseThrow();
        assertThat(promoted.getRole()).isEqualTo(Role.ADMIN);
        assertThat(promoted.getLoginId()).isEqualTo("W800000");
        assertThat(promoted.getPasswordHash()).isEqualTo(account.getPasswordHash());
        assertThat(promoted.getContactPhone()).isEqualTo(account.getContactPhone());
        assertThat(promoted.getCreatedAt()).isEqualTo(created);
        assertThat(call("GET", "/api/admin/workers", oldToken, null).statusCode()).isEqualTo(200);
        assertThat(changeRole(id, "WORKER", "ADMIN", highestToken()).statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/admin/workers", oldToken, null).statusCode()).isEqualTo(403);
    }

    @Test void managersCannotEditPeersOrRolesAndHighestAccountsCannotBeModified() throws Exception {
        var manager = accounts.saveAndFlush(Account.createAdmin("permission-manager", "hash", "관리자"));
        var peer = accounts.saveAndFlush(Account.createAdmin("permission-peer", "hash", "동료 관리자"));
        var worker = worker("permission-worker", false);
        var managerToken = tokens.generateToken(manager);
        assertThat(changeRole(worker.getAccountId(), "ADMIN", "WORKER", managerToken).statusCode()).isEqualTo(403);
        assertThat(call("PATCH", base(peer) + "/status", managerToken, "{\"status\":\"INACTIVE\"}").statusCode()).isEqualTo(403);
        assertThat(call("PATCH", base(peer) + "/password-reset", managerToken, null).statusCode()).isEqualTo(403);
        assertThat(call("PATCH", base(worker) + "/status", managerToken, "{\"status\":\"INACTIVE\"}").statusCode()).isEqualTo(200);
        assertThat(call("PATCH", base(worker) + "/password-reset", managerToken, null).statusCode()).isEqualTo(200);
        var highest = accounts.findByLoginId("superadmin1").orElseThrow();
        var highestToken = highestToken();
        assertThat(changeRole(highest.getAccountId(), "ADMIN", "SUPER_ADMIN", highestToken).statusCode()).isEqualTo(403);
        assertThat(call("PATCH", base(highest) + "/status", highestToken, "{\"status\":\"INACTIVE\"}").statusCode()).isEqualTo(403);
        assertThat(call("PATCH", base(highest) + "/password-reset", highestToken, null).statusCode()).isEqualTo(403);
        assertThat(changeRole(worker.getAccountId(), "SUPER_ADMIN", "WORKER", highestToken).statusCode()).isEqualTo(400);
        assertThat(changeRole(peer.getAccountId(), "WORKER", "WORKER", highestToken).statusCode()).isEqualTo(409);
        assertThat(changeRole(Long.MAX_VALUE, "ADMIN", "WORKER", highestToken).statusCode()).isEqualTo(404);
        assertThat(changeRole(worker.getAccountId(), "ADMIN", "WORKER", null).statusCode()).isEqualTo(401);
    }

    @Test void highestCanDisableAndResetAdministratorWhoMustThenChangePassword() throws Exception {
        var admin = accounts.saveAndFlush(Account.createAdmin("reset-admin", passwords.encode("original-password"), "관리자"));
        var token = tokens.generateToken(admin);
        assertThat(call("PATCH", base(admin) + "/status", highestToken(), "{\"status\":\"INACTIVE\"}").statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/admin/workers", token, null).statusCode()).isEqualTo(403);
        assertThat(call("PATCH", base(admin) + "/status", highestToken(), "{\"status\":\"ACTIVE\"}").statusCode()).isEqualTo(200);
        var reset = call("PATCH", base(admin) + "/password-reset", highestToken(), null);
        assertThat(reset.statusCode()).isEqualTo(200);
        var temporary = json(reset).path("temporaryPassword").asText();
        assertThat(passwords.matches(temporary, accounts.findById(admin.getAccountId()).orElseThrow().getPasswordHash())).isTrue();
        var blocked = call("GET", "/api/admin/workers", token, null);
        assertThat(blocked.statusCode()).isEqualTo(403);
        assertThat(blocked.body()).contains("PASSWORD_CHANGE_REQUIRED");
        assertThat(call("PATCH", "/api/auth/password", token, "{\"currentPassword\":\"" + temporary + "\",\"newPassword\":\"new-admin-password\"}").statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/admin/workers", token, null).statusCode()).isEqualTo(200);
    }

    @Test void promotionDoesNotBypassInitialPasswordChangeAndDemotionRestoresWorkerOnboarding() throws Exception {
        var worker = worker("temporary-worker", true);
        var token = tokens.generateToken(worker);
        assertThat(changeRole(worker.getAccountId(), "ADMIN", "WORKER", highestToken()).statusCode()).isEqualTo(200);
        var blocked = call("GET", "/api/admin/workers", token, null);
        assertThat(blocked.statusCode()).isEqualTo(403);
        assertThat(blocked.body()).contains("PASSWORD_CHANGE_REQUIRED");
        assertThat(call("PATCH", "/api/auth/password", token, "{\"currentPassword\":\"initial-password\",\"newPassword\":\"updated-password\"}").statusCode()).isEqualTo(200);
        assertThat(changeRole(worker.getAccountId(), "WORKER", "ADMIN", highestToken()).statusCode()).isEqualTo(200);
        assertThat(accounts.findById(worker.getAccountId()).orElseThrow().isContactOnboardingRequired()).isTrue();
    }

    @Test void promotedWorkerIdsAreStillReservedWhenGeneratingNextWorker() throws Exception {
        var worker = worker("W999990", false);
        assertThat(changeRole(worker.getAccountId(), "ADMIN", "WORKER", highestToken()).statusCode()).isEqualTo(200);
        var result = call("POST", "/api/admin/workers", highestToken(), "{\"name\":\"신규 작업자\"}");
        assertThat(result.statusCode()).isEqualTo(201);
        assertThat(json(result).path("loginId").asText()).isEqualTo("W999991");
    }

    private Account worker(String id, boolean temporary) {
        var account = Account.createWorker(id, passwords.encode("initial-password"), "작업자");
        if (!temporary) {
            account.changePassword(passwords.encode("initial-password"));
            account.completeContactOnboarding("01098765432", "v1", LocalDateTime.now());
        }
        return accounts.saveAndFlush(account);
    }
    private String highestToken() { return tokens.generateToken(accounts.findByLoginId("superadmin1").orElseThrow()); }
    private String base(Account account) { return "/api/admin/workers/" + account.getAccountId(); }
    private HttpResponse<String> changeRole(Long id, String role, String expected, String token) throws Exception {
        return call("PATCH", "/api/admin/workers/" + id + "/role", token, "{\"role\":\"" + role + "\",\"expectedRole\":\"" + expected + "\"}");
    }
    private JsonNode json(HttpResponse<String> response) throws Exception { return mapper.readTree(response.body()); }
    private HttpResponse<String> call(String method, String path, String token, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).header("Content-Type", "application/json");
        if (token != null) request.header("Authorization", "Bearer " + token);
        return http.send(request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
