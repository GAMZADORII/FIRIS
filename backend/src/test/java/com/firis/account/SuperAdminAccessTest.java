package com.firis.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.firis.account.entity.Account;
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
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:superadmin;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.config.import=", "security.jwt.secret=unit-test-only-secret-0123456789-abcdef",
    "app.admin.password=", "AI_API_KEY=test-only-ai-key"
})
class SuperAdminAccessTest {
    @LocalServerPort int port;
    @Autowired AccountRepository accounts;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtTokenProvider tokens;
    @Autowired ObjectMapper mapper;
    private final HttpClient http = HttpClient.newHttpClient();

    @Test void highestAdministratorCanLoginAndAccessAdminAndMonitoringApis() throws Exception {
        var account = accounts.saveAndFlush(Account.createSuperAdmin("superadmin-test", passwords.encode("1234"), "최고 관리자"));
        var login = call("POST", "/api/auth/login", null, "{\"loginId\":\"superadmin-test\",\"password\":\"1234\"}");
        assertThat(login.statusCode()).isEqualTo(200);
        var data = mapper.readTree(login.body());
        assertThat(data.path("account").path("role").asText()).isEqualTo("SUPER_ADMIN");
        var token = data.path("accessToken").asText();
        assertThat(call("GET", "/api/admin/workers", token, null).statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/cameras", token, null).statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/events", token, null).statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/auth/contact", token, null).statusCode()).isEqualTo(403);
        account.changeStatus(com.firis.account.entity.AccountStatus.INACTIVE);
        accounts.saveAndFlush(account);
        assertThat(call("GET", "/api/admin/workers", token, null).statusCode()).isEqualTo(403);
    }

    @Test void existingAdministratorStillHasAccessAndWorkerCannotManageAccounts() throws Exception {
        var admin = accounts.saveAndFlush(Account.createAdmin("admin-access-test", "hash", "관리자"));
        assertThat(call("GET", "/api/admin/workers", tokens.generateToken(admin), null).statusCode()).isEqualTo(200);
        var worker = Account.createWorker("worker-access-test", "hash", "작업자");
        worker.changePassword("changed-hash");
        worker.completeContactOnboarding("01012345678", "v1", LocalDateTime.now());
        accounts.saveAndFlush(worker);
        assertThat(call("GET", "/api/admin/workers", tokens.generateToken(worker), null).statusCode()).isEqualTo(403);
        assertThat(call("GET", "/api/admin/workers", null, null).statusCode()).isEqualTo(401);
    }

    @Test void roleCountsIncludeAllRolesAndAreRestrictedToAdministrators() throws Exception {
        var superAdmin = accounts.saveAndFlush(Account.createSuperAdmin("counts-super", "hash", "최고 관리자"));
        var admin = accounts.saveAndFlush(Account.createAdmin("counts-admin", "hash", "관리자"));
        var worker = Account.createWorker("counts-worker", "hash", "작업자");
        worker.changePassword("changed-hash");
        accounts.saveAndFlush(worker);
        var response = call("GET", "/api/admin/accounts/role-counts", tokens.generateToken(superAdmin), null);
        assertThat(response.statusCode()).isEqualTo(200);
        var counts = mapper.readTree(response.body());
        assertThat(counts.path("superAdmins").asLong()).isEqualTo(accounts.countByRole(com.firis.account.entity.Role.SUPER_ADMIN));
        assertThat(counts.path("admins").asLong()).isEqualTo(accounts.countByRole(com.firis.account.entity.Role.ADMIN));
        assertThat(counts.path("workers").asLong()).isEqualTo(accounts.countByRole(com.firis.account.entity.Role.WORKER));
        assertThat(call("GET", "/api/admin/accounts/role-counts", tokens.generateToken(admin), null).statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/admin/accounts/role-counts", tokens.generateToken(worker), null).statusCode()).isEqualTo(403);
        assertThat(call("GET", "/api/admin/accounts/role-counts", null, null).statusCode()).isEqualTo(401);
    }

    private HttpResponse<String> call(String method, String path, String token, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json");
        if (token != null) request.header("Authorization", "Bearer " + token);
        return http.send(request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
