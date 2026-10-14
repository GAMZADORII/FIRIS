package com.firis.event;

import com.firis.account.entity.Account;
import com.firis.account.entity.AccountStatus;
import com.firis.account.repository.AccountRepository;
import com.firis.auth.security.JwtTokenProvider;
import com.firis.camera.entity.Camera;
import com.firis.camera.repository.CameraRepository;
import com.firis.event.entity.*;
import com.firis.event.repository.*;
import java.time.LocalDateTime;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.config.import=", "AI_API_KEY=training-test-only",
    "app.admin.password=", "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
class TrainingCandidateApiTest {
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        String url = System.getenv("FIRIS_TRAINING_TEST_DB_URL");
        if (url == null || url.isBlank()) {
            properties.add("spring.datasource.url", () -> "jdbc:h2:mem:training;MODE=MySQL;DB_CLOSE_DELAY=-1");
            properties.add("spring.datasource.driver-class-name", () -> "org.h2.Driver");
            properties.add("spring.datasource.username", () -> "sa");
            properties.add("spring.datasource.password", () -> "");
        } else {
            if (!url.matches("^jdbc:mysql://[^/]+/firis_training_test(?:\\?.*)?$")) {
                throw new IllegalStateException("Only the isolated firis_training_test database is allowed");
            }
            properties.add("spring.datasource.url", () -> url);
            properties.add("spring.datasource.username", () -> System.getenv("FIRIS_TRAINING_TEST_DB_USERNAME"));
            properties.add("spring.datasource.password", () -> System.getenv("FIRIS_TRAINING_TEST_DB_PASSWORD"));
        }
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AccountRepository accounts;
    @Autowired CameraRepository cameras;
    @Autowired FireEventRepository events;
    @Autowired EventReviewRepository reviews;
    @Autowired JwtTokenProvider tokens;
    @Autowired com.firis.event.config.TrainingCandidateInitializer initializer;
    Account admin;
    String adminToken;
    String workerToken;
    long falseEventId;
    long trueEventId;
    long pendingEventId;

    @BeforeEach void seed() {
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        admin = accounts.saveAndFlush(Account.createAdmin("admin-" + suffix, "unused", "Admin"));
        var worker = Account.createWorker("worker-" + suffix, "unused", "Worker");
        worker.changePassword("unused");
        worker.completeContactOnboarding("01012345678", "v1", LocalDateTime.now());
        worker = accounts.saveAndFlush(worker);
        adminToken = tokens.generateToken(admin);
        workerToken = tokens.generateToken(worker);
        var camera = cameras.saveAndFlush(Camera.create("test-" + suffix, "Test", "Factory", null, "ONLINE"));
        var now = LocalDateTime.now();
        var falseEvent = events.saveAndFlush(new FireEvent(camera, EventType.FIRE, 0.9, now, "test", now));
        var trueEvent = events.saveAndFlush(new FireEvent(camera, EventType.FIRE, 0.9, now, "test", now));
        pendingEventId = events.saveAndFlush(new FireEvent(camera, EventType.FIRE, 0.9, now, "test", now)).getEventId();
        falseEventId = falseEvent.getEventId();
        trueEventId = trueEvent.getEventId();
        reviews.saveAndFlush(new EventReview(falseEvent, worker, ReviewResult.FALSE_POSITIVE,
                FalsePositiveReason.STEAM, "Steam", now));
        reviews.saveAndFlush(new EventReview(trueEvent, worker, ReviewResult.TRUE_FIRE, null, null, now));
    }

    private void readCandidate(long id, boolean expected) throws Exception {
        mvc.perform(get("/api/events/{id}", id).header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.review.trainingCandidate").value(expected));
        assertThat(jdbc.queryForObject("select training_candidate from event_review where event_id=?",
                Boolean.class, id)).isEqualTo(expected);
    }

    @Test void falsePositiveReviewAutomaticallyPersistsCandidateAcrossRequests() throws Exception {
        mvc.perform(patch("/api/events/{id}/review", pendingEventId)
            .header("Authorization", "Bearer " + workerToken).contentType("application/json")
            .content("{\"result\":\"FALSE_POSITIVE\",\"falsePositiveReason\":\"STEAM\",\"note\":\"Steam\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.review.trainingCandidate").value(true))
            .andExpect(jsonPath("$.review.reviewerName").value("Worker"))
            .andExpect(jsonPath("$.review.reviewedAt").isNotEmpty());
        readCandidate(pendingEventId, true);
        readCandidate(falseEventId, true);
        readCandidate(trueEventId, false);
    }

    @Test void includesOldFalsePositivesIdempotentlyWithoutChangingOriginalReview() throws Exception {
        jdbc.update("update event_review set training_candidate=false where event_id=?", falseEventId);
        var original = jdbc.queryForMap("select reviewer_id,result,false_positive_reason,note,reviewed_at from event_review where event_id=?", falseEventId);
        initializer.run(null);
        readCandidate(falseEventId, true);
        readCandidate(trueEventId, false);
        assertThat(reviews.includeExistingFalsePositives()).isZero();
        assertThat(jdbc.queryForMap("select reviewer_id,result,false_positive_reason,note,reviewed_at from event_review where event_id=?", falseEventId)).isEqualTo(original);
    }

    @Test void requiresAuthenticatedActiveReviewerAndDoesNotPersistInvalidReview() throws Exception {
        String body = "{\"result\":\"FALSE_POSITIVE\",\"falsePositiveReason\":\"STEAM\"}";
        mvc.perform(patch("/api/events/{id}/review", pendingEventId).contentType("application/json").content(body))
            .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/events/{id}/review", pendingEventId).header("Authorization", "Bearer invalid")
            .contentType("application/json").content(body)).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/events/{id}/review", pendingEventId).header("Authorization", "Bearer " + adminToken)
            .contentType("application/json").content("{\"result\":\"FALSE_POSITIVE\"}"))
            .andExpect(status().isBadRequest());
        admin.changeStatus(AccountStatus.INACTIVE); accounts.saveAndFlush(admin);
        mvc.perform(patch("/api/events/{id}/review", pendingEventId).header("Authorization", "Bearer " + adminToken)
            .contentType("application/json").content(body)).andExpect(status().isForbidden());
        assertThat(reviews.existsByEvent_EventId(pendingEventId)).isFalse();
    }

    @Test void pagesAllFalsePositivesWithCameraFilter() throws Exception {
        String cameraId = jdbc.queryForObject("select camera_id from fire_event where event_id=?", String.class, falseEventId);
        var camera = cameras.findById(cameraId).orElseThrow();
        var now = LocalDateTime.now();
        for (int i = 0; i < 7; i++) {
            var event = events.saveAndFlush(new FireEvent(camera, EventType.FIRE, 0.9, now, "test", now));
            reviews.saveAndFlush(new EventReview(event, admin, ReviewResult.FALSE_POSITIVE, FalsePositiveReason.STEAM, null, now));
        }
        for (int page = 0; page < 2; page++) {
            mvc.perform(get("/api/events").header("Authorization", "Bearer " + adminToken)
                .param("reviewStatus", "FALSE_POSITIVE").param("cameraId", cameraId)
                .param("size", "6").param("page", String.valueOf(page)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(8))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content.length()").value(page == 0 ? 6 : 2));
        }
    }
    @Test void filtersReasonsAcrossPagesAndRejectsInvalidOrConflictingFilters() throws Exception {
        String cameraId = jdbc.queryForObject("select camera_id from fire_event where event_id=?", String.class, falseEventId);
        var camera = cameras.findById(cameraId).orElseThrow();
        var now = LocalDateTime.now();
        for (int i = 0; i < 8; i++) {
            var event = events.saveAndFlush(new FireEvent(camera, EventType.FIRE, 0.9, now, "test", now));
            reviews.saveAndFlush(new EventReview(event, admin, ReviewResult.FALSE_POSITIVE,
                    i < 7 ? FalsePositiveReason.STEAM : FalsePositiveReason.DUST, null, now));
        }
        for (int page = 0; page < 2; page++) {
            mvc.perform(get("/api/events").header("Authorization", "Bearer " + adminToken)
                .param("reviewStatus", "FALSE_POSITIVE").param("cameraId", cameraId)
                .param("falsePositiveReason", "STEAM").param("size", "6").param("page", String.valueOf(page)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(8))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content.length()").value(page == 0 ? 6 : 2));
        }
        mvc.perform(get("/api/events").header("Authorization", "Bearer " + adminToken)
            .param("cameraId", cameraId).param("falsePositiveReason", "DUST"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/events").header("Authorization", "Bearer " + adminToken)
            .param("cameraId", cameraId).param("falsePositiveReason", "WELDING"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/events").header("Authorization", "Bearer " + adminToken)
            .param("falsePositiveReason", "INVALID")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/events").header("Authorization", "Bearer " + adminToken)
            .param("reviewStatus", "UNREVIEWED").param("falsePositiveReason", "STEAM"))
            .andExpect(status().isBadRequest());
    }
}