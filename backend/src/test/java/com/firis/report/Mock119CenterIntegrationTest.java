package com.firis.report;

import com.fasterxml.jackson.databind.*;
import com.firis.account.entity.Account;
import com.firis.account.repository.AccountRepository;
import com.firis.camera.repository.CameraRepository;
import com.firis.event.entity.*;
import com.firis.event.repository.*;
import com.firis.report.repository.Mock119ReportRepository;
import com.firis.report.service.Mock119CenterService;
import jakarta.persistence.EntityManager;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:mock119websocket;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.config.import=", "security.jwt.secret=unit-test-only-secret-0123456789-abcdef",
    "app.admin.password=", "app.mock-119.delivery-mode=integrated", "app.mock-119.center-enabled=true",
    "app.mock-119.site-address=", "app.mock-119.control-room-phone=",
    "app.event.storage-directory=./build/mock119-test-events", "AI_API_KEY=test-only-ai-key"
})
class Mock119CenterIntegrationTest {
    @LocalServerPort int port;
    @Autowired AccountRepository accounts;
    @Autowired CameraRepository cameras;
    @Autowired FireEventRepository events;
    @Autowired EventReviewRepository reviews;
    @Autowired Mock119ReportRepository reports;
    @Autowired Mock119CenterService center;
    @Autowired PasswordEncoder passwords;
    @Autowired TransactionTemplate tx;
    @Autowired EntityManager em;
    @Autowired ObjectMapper mapper;
    private final HttpClient http = HttpClient.newHttpClient();

    @Test void reportPersistsBeforeNotificationAndSharedCompletionSurvivesReconnect() throws Exception {
        long eventId = tx.execute(s -> {
            var worker = Account.createAdmin("center-test-worker", passwords.encode("test-password"), "시연 관리자");
            accounts.save(worker);
            return events.saveAndFlush(new FireEvent(cameras.findById("CAM001").orElseThrow(),
                    EventType.FIRE, 0.98, LocalDateTime.now(ZoneId.of("Asia/Seoul")), "test", LocalDateTime.now())).getEventId();
        });
        assertThat(call("GET", "/api/events/" + eventId, null, null).statusCode()).isEqualTo(401);
        var login = json(call("POST", "/api/auth/login", null,
                "{\"loginId\":\"center-test-worker\",\"password\":\"test-password\"}"));
        var token = login.path("accessToken").asText();
        var preview = json(call("GET", "/api/events/" + eventId + "/mock-119-preview", token, null));
        assertThat(preview.path("readyToReport").asBoolean()).isTrue();
        assertThat(preview.path("missingFields").size()).isZero();
        assertThat(accounts.findByLoginId("center-test-worker").orElseThrow().getContactPhone()).isNull();

        var notifications = new LinkedBlockingQueue<String>();
        var socket = http.newWebSocketBuilder().header("Origin", "http://localhost:5174")
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/mock-119-center"), new WebSocket.Listener() {
                    private final StringBuilder buffer = new StringBuilder();
                    @Override public void onOpen(WebSocket ws) { ws.request(1); }
                    @Override public CompletionStage<?> onText(WebSocket ws, CharSequence text, boolean last) {
                        buffer.append(text);
                        if (last) { notifications.add(buffer.toString()); buffer.setLength(0); }
                        ws.request(1); return null;
                    }
                }).get(5, TimeUnit.SECONDS);
        try {
            var result = call("POST", "/api/events/" + eventId + "/mock-119-reports", token, "");
            assertThat(result.statusCode()).isEqualTo(200);
            var submitted = json(result);
            assertThat(submitted.path("status").asText()).isEqualTo("ACCEPTED");
            long id = submitted.path("reportId").asLong();
            assertThat(json(notifications.poll(5, TimeUnit.SECONDS)).path("type").asText()).isEqualTo("REPORT_CREATED");
            var detail = json(call("GET", "/api/mock-119-center/reports/" + id, null, null));
            assertThat(detail.path("responseStatus").asText()).isEqualTo("PENDING");
            assertThat(detail.path("history").size()).isEqualTo(1);
            assertThat(detail.path("reporterPhone").asText()).isEmpty();
            assertThat(detail.path("controlRoomPhone").asText()).isEmpty();
            assertThat(detail.path("siteAddress").asText()).isEmpty();
            assertThat(call("GET", "/api/events/" + eventId + "/video", null, null).statusCode()).isEqualTo(401);
            assertThat(call("GET", "/api/mock-119-center/reports/999999/video", null, null).statusCode()).isEqualTo(404);
            assertThat(json(call("POST", "/api/events/" + eventId + "/mock-119-reports", token, "")).path("receiptId"))
                    .isEqualTo(submitted.path("receiptId"));
            assertThat(notifications.poll(200, TimeUnit.MILLISECONDS)).isNull();
            assertThat(change(id, "PENDING", "CLOSED").statusCode()).isEqualTo(400);
            tx.executeWithoutResult(s -> {
                center.transition(id, com.firis.report.entity.Mock119ResponseStatus.PENDING,
                        com.firis.report.entity.Mock119ResponseStatus.DISPATCHED);
                s.setRollbackOnly();
            });
            assertThat(notifications.poll(200, TimeUnit.MILLISECONDS)).isNull();
            assertThat(json(call("GET", "/api/mock-119-center/reports/" + id, null, null))
                    .path("responseStatus").asText()).isEqualTo("PENDING");
            assertThat(change(id, "PENDING", "DISPATCHED").statusCode()).isEqualTo(200);
            assertThat(json(notifications.poll(5, TimeUnit.SECONDS)).path("type").asText()).isEqualTo("REPORT_UPDATED");
            assertThat(change(id, "PENDING", "CLOSED").statusCode()).isEqualTo(409);
            assertThat(change(id, "DISPATCHED", "CLOSED").statusCode()).isEqualTo(400);
            tx.executeWithoutResult(s -> {
                var r = reports.findById(id).orElseThrow();
                ReflectionTestUtils.setField(r, "arrivalAt", LocalDateTime.now(ZoneId.of("Asia/Seoul")).minusSeconds(1));
                em.flush();
            });
            center.arrive(id);
            assertThat(change(id, "ARRIVED", "CLOSED").statusCode()).isEqualTo(200);
            assertThat(change(id, "ARRIVED", "CLOSED").statusCode()).isEqualTo(200);
            var completed = json(call("GET", "/api/events/" + eventId, token, null));
            assertThat(completed.path("responseCompletedAt").isNull()).isFalse();
            assertThat(reviews.findByEvent_EventId(eventId)).isEmpty();
            socket.sendClose(WebSocket.NORMAL_CLOSURE, "reload").get(5, TimeUnit.SECONDS);
            var snapshot = json(call("GET", "/api/mock-119-center/reports", null, null));
            assertThat(snapshot.path("totalElements").asInt()).isEqualTo(1);
            assertThat(snapshot.path("content").get(0).path("responseStatus").asText()).isEqualTo("CLOSED");
            assertThat(snapshot.path("content").get(0).path("history").size()).isEqualTo(4);
        } finally { socket.abort(); }
    }
    private HttpResponse<String> change(long id, String expected, String target) throws Exception {
        return call("PATCH", "/api/mock-119-center/reports/" + id + "/response-status", null,
                "{\"expectedStatus\":\"" + expected + "\",\"responseStatus\":\"" + target + "\"}");
    }
    private HttpResponse<String> call(String method, String path, String token, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .timeout(Duration.ofSeconds(10)).header("Content-Type", "application/json");
        if (token != null) request.header("Authorization", "Bearer " + token);
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
    private JsonNode json(HttpResponse<String> response) throws Exception { return json(response.body()); }
    private JsonNode json(String body) throws Exception { assertThat(body).isNotNull(); return mapper.readTree(body); }
}
