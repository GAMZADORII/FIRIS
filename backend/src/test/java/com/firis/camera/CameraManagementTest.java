package com.firis.camera;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.firis.account.entity.Account;
import com.firis.account.repository.AccountRepository;
import com.firis.auth.security.JwtTokenProvider;
import com.firis.camera.config.CameraInitializer;
import com.firis.camera.repository.CameraRepository;
import com.firis.event.entity.EventType;
import com.firis.event.entity.FireEvent;
import com.firis.event.repository.FireEventRepository;
import java.net.URI;
import java.net.http.*;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:cameramanagement;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.config.import=", "security.jwt.secret=unit-test-only-secret-0123456789-abcdef",
    "app.admin.password=", "AI_API_KEY=test-only-ai-key",
    "app.camera.base-url=https://firis.test:8443///"
})
class CameraManagementTest {
    @LocalServerPort int port;
    @Autowired CameraRepository cameras;
    @Autowired FireEventRepository events;
    @Autowired AccountRepository accounts;
    @Autowired CameraInitializer initializer;
    @Autowired JwtTokenProvider tokens;
    @Autowired ObjectMapper mapper;
    private final HttpClient http = HttpClient.newHttpClient();

    @Test void registrationAndDeletionPreserveHistoryAndDoNotRestoreDeletedSeedCameras() throws Exception {
        var admin = accounts.saveAndFlush(Account.createSuperAdmin("camera-super-test", "hash", "최고 관리자"));
        var token = tokens.generateToken(admin);
        var body = "{\"cameraId\":\"CAM010\",\"cameraName\":\"새 CCTV\",\"location\":\"공장 신규 구역\",\"streamUrl\":\"https://example.com/camera.mp4\",\"status\":\"ONLINE\",\"reportNote\":\"보관 구역\"}";
        assertThat(call("POST", "/api/cameras", token, body).statusCode()).isEqualTo(201);
        assertThat(call("POST", "/api/cameras", token, body).statusCode()).isEqualTo(409);
        assertThat(call("GET", "/api/cameras", token, null).body()).contains("CAM010", "보관 구역");
        var camera = cameras.findById("CAM010").orElseThrow();
        var eventId = events.saveAndFlush(new FireEvent(camera, EventType.FIRE, .9,
                LocalDateTime.now(), "test", LocalDateTime.now())).getEventId();
        assertThat(call("DELETE", "/api/cameras/CAM010", token, null).statusCode()).isEqualTo(204);
        assertThat(call("DELETE", "/api/cameras/CAM010", token, null).statusCode()).isEqualTo(204);
        assertThat(call("GET", "/api/cameras", token, null).body()).doesNotContain("CAM010");
        assertThat(call("GET", "/api/events/" + eventId, token, null).statusCode()).isEqualTo(200);
        assertThat(cameras.findById("CAM010").orElseThrow().isDeleted()).isTrue();
        assertThat(cameras.findById("CAM010").orElseThrow().getStatus()).isEqualTo("OFFLINE");
        assertThat(call("POST", "/api/cameras", token, body).statusCode()).isEqualTo(409);
        assertThat(call("GET", "/api/cameras/CAM010/frame", token, null).statusCode()).isEqualTo(404);
        var aiBody = "{\"cameraId\":\"CAM010\",\"eventType\":\"FIRE\",\"confidence\":0.9,\"detectedAt\":\"2026-10-14T16:00:00\",\"snapshotPath\":\"/app/storage/events/test.jpg\"}";
        var aiRequest = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/ai/events"))
                .header("Content-Type", "application/json").header("X-AI-API-KEY", "test-only-ai-key")
                .POST(HttpRequest.BodyPublishers.ofString(aiBody)).build();
        assertThat(http.send(aiRequest, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(404);
        assertThat(call("DELETE", "/api/cameras/CAM001", token, null).statusCode()).isEqualTo(204);
        initializer.run(null);
        assertThat(cameras.findById("CAM001").orElseThrow().isDeleted()).isTrue();
        assertThat(call("DELETE", "/api/cameras/MISSING", token, null).statusCode()).isEqualTo(404);
    }

    @Test void onlyAdministratorsCanAddOrDeleteCamerasAndInputIsValidated() throws Exception {
        var worker = Account.createWorker("camera-worker-test", "hash", "작업자");
        worker.changePassword("new-hash");
        accounts.saveAndFlush(worker);
        var workerToken = tokens.generateToken(worker);
        assertThat(call("DELETE", "/api/cameras/CAM002", workerToken, null).statusCode()).isEqualTo(403);
        assertThat(call("POST", "/api/cameras", workerToken, "{}").statusCode()).isEqualTo(403);
        assertThat(call("DELETE", "/api/cameras/CAM002", null, null).statusCode()).isEqualTo(401);
        var admin = accounts.saveAndFlush(Account.createAdmin("camera-admin-test", "hash", "관리자"));
        var adminToken = tokens.generateToken(admin);
        assertThat(call("POST", "/api/cameras", adminToken, "{}").statusCode()).isEqualTo(400);
        var body = "{\"cameraId\":\"CUSTOM\",\"cameraName\":\"Custom\",\"streamUrl\":\"https://example.com/video\",\"status\":\"OFFLINE\"}";
        assertThat(call("POST", "/api/cameras", adminToken, body).statusCode()).isEqualTo(201);
        assertThat(call("DELETE", "/api/cameras/CUSTOM", adminToken, null).statusCode()).isEqualTo(204);
        assertThat(call("POST", "/api/cameras", adminToken, body.replace("https://", "rtsp://")).statusCode()).isEqualTo(400);
    }

    @Test void omittedOrBlankVideoUrlIsGeneratedFromCameraIdAndConfiguredBase() throws Exception {
        var token = tokens.generateToken(accounts.findByLoginId("superadmin1").orElseThrow());
        var omitted = "{\"cameraId\":\"AUTO_VIDEO\",\"cameraName\":\"자동 영상\",\"status\":\"ONLINE\"}";
        var result = call("POST", "/api/cameras", token, omitted);
        assertThat(result.statusCode()).isEqualTo(201);
        assertThat(mapper.readTree(result.body()).path("streamUrl").asText())
                .isEqualTo("https://firis.test:8443/videos/AUTO_VIDEO/001.mp4");
        var blank = "{\"cameraId\":\"EMPTY_VIDEO\",\"cameraName\":\"자동 영상\",\"streamUrl\":\"\",\"status\":\"OFFLINE\"}";
        assertThat(call("POST", "/api/cameras", token, blank).statusCode()).isEqualTo(201);
        assertThat(cameras.findById("EMPTY_VIDEO").orElseThrow().getStreamUrl())
                .isEqualTo("https://firis.test:8443/videos/EMPTY_VIDEO/001.mp4");
    }

    private HttpResponse<String> call(String method, String path, String token, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).header("Content-Type", "application/json");
        if (token != null) request.header("Authorization", "Bearer " + token);
        return http.send(request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
