package com.firis.account.config;

import com.firis.account.entity.Role;
import com.firis.account.repository.AccountRepository;
import com.firis.camera.config.CameraInitializer;
import com.firis.camera.repository.CameraRepository;
import com.firis.camera.service.CameraService;
import com.firis.event.repository.FireEventRepository;
import java.net.URI;
import java.net.http.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:defaultbootstrap;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.config.import=", "security.jwt.secret=unit-test-only-secret-0123456789-abcdef",
    "app.admin.password=bootstrap-admin-password", "app.super-admin.enabled=true", "app.super-admin.password=1234"
})
class DefaultDataBootstrapTest {
    @LocalServerPort int port;
    @Autowired AccountRepository accounts;
    @Autowired CameraRepository cameras;
    @Autowired CameraService cameraService;
    @Autowired FireEventRepository events;
    @Autowired PasswordEncoder passwords;
    @Autowired SuperAdminAccountInitializer superAdmins;
    @Autowired AdminAccountInitializer admins;
    @Autowired CameraInitializer cameraInitializer;

    @Test void emptyDatabaseStartsWithUsableAccountsAndRepeatStartupPreservesData() throws Exception {
        var first = accounts.findByLoginId("superadmin1").orElseThrow();
        var second = accounts.findByLoginId("superadmin2").orElseThrow();
        assertThat(first.getRole()).isEqualTo(Role.SUPER_ADMIN);
        assertThat(first.getName()).isEqualTo("박상현");
        assertThat(second.getName()).isEqualTo("차나래");
        assertThat(passwords.matches("1234", first.getPasswordHash())).isTrue();
        assertThat(passwords.matches("1234", second.getPasswordHash())).isTrue();
        assertThat(accounts.countByRole(Role.SUPER_ADMIN)).isEqualTo(2);
        assertThat(accounts.countByRole(Role.ADMIN)).isEqualTo(1);
        assertThat(cameras.count()).isEqualTo(9);
        assertThat(events.count()).isZero();
        var http = HttpClient.newHttpClient();
        for (var loginId : new String[] {"superadmin1", "superadmin2"}) {
            var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{\"loginId\":\"" + loginId + "\",\"password\":\"1234\"}")).build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).contains("SUPER_ADMIN");
        }
        String originalHash = first.getPasswordHash();
        Long originalId = first.getAccountId();
        cameraService.deleteCamera("CAM001");
        superAdmins.run(null); admins.run(null); cameraInitializer.run(null);
        assertThat(accounts.countByRole(Role.SUPER_ADMIN)).isEqualTo(2);
        assertThat(accounts.countByRole(Role.ADMIN)).isEqualTo(1);
        assertThat(accounts.findByLoginId("superadmin1").orElseThrow().getPasswordHash()).isEqualTo(originalHash);
        assertThat(accounts.findByLoginId("superadmin1").orElseThrow().getAccountId()).isEqualTo(originalId);
        assertThat(cameras.count()).isEqualTo(9);
        assertThat(cameras.findById("CAM001").orElseThrow().isDeleted()).isTrue();
        assertThat(events.count()).isZero();
    }
}
