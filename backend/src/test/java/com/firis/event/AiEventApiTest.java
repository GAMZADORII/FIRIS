package com.firis.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.firis.event.entity.EventMedia;
import com.firis.event.repository.EventMediaRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfEnvironmentVariable(named = "FIRIS_TEST_DB_URL", matches = ".+")
@SpringBootTest(properties = {"spring.config.import=", "AI_API_KEY=test-only-key",
    "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
class AiEventApiTest {
    @DynamicPropertySource
    static void testDatabase(DynamicPropertyRegistry properties) {
        String url = System.getenv("FIRIS_TEST_DB_URL");
        if (!url.matches("^jdbc:mysql://[^/]+/firis_test(?:\\?.*)?$")) {
            throw new IllegalStateException("FIRIS_TEST_DB_URL은 전용 firis_test MySQL DB여야 합니다.");
        }
        String username = System.getenv("FIRIS_TEST_DB_USERNAME");
        String password = System.getenv("FIRIS_TEST_DB_PASSWORD");
        if (username == null || username.isBlank() || password == null) {
            throw new IllegalStateException("FIRIS_TEST_DB_USERNAME/PASSWORD를 설정해야 합니다.");
        }
        properties.add("spring.datasource.url", () -> url);
        properties.add("spring.datasource.username", () -> username);
        properties.add("spring.datasource.password", () -> password);
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired com.firis.event.service.AiEventService service;
    @MockitoSpyBean EventMediaRepository media;
    private static final String EVENT = """
        {"cameraId":"camera-1","eventType":"SMOKE","confidence":0.91,
         "detectedAt":"2026-10-07T14:30:25","snapshotPath":"/storage/events/sample.jpg","modelVersion":"fire-v1"}
        """;
    private static final String VIDEO = """
        {"videoPath":"/storage/events/sample.mp4","preSeconds":5,"postSeconds":5}
        """;

    @BeforeEach void prepare() {
        reset(media);
        jdbc.update("delete from event_media");
        jdbc.update("delete from fire_event");
        jdbc.update("delete from camera");
        jdbc.update("insert into camera(camera_id,camera_name,status) values ('camera-1','Test Camera','ONLINE')");
    }

    private long createEvent() throws Exception {
        var result = mvc.perform(post("/api/ai/events").header("X-AI-API-KEY", "test-only-key")
            .contentType("application/json").content(EVENT))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.reviewStatus").value("UNREVIEWED"))
            .andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).get("eventId").asLong();
    }

    @Test void createsImmediatelyThenUpdatesSameMediaPreservingSnapshot() throws Exception {
        long id = createEvent();
        var row = jdbc.queryForMap("select * from event_media where event_id=?", id);
        assertThat(row.get("video_path")).isNull();
        assertThat(row.get("snapshot_path")).isEqualTo("/storage/events/sample.jpg");
        for (int i=0; i<2; i++) {
            mvc.perform(patch("/api/ai/events/{id}/media", id).header("X-AI-API-KEY", "test-only-key")
                .contentType("application/json").content(VIDEO))
                .andExpect(status().isOk()).andExpect(jsonPath("$.eventId").value(id))
                .andExpect(jsonPath("$.videoAvailable").value(true));
        }
        assertThat(jdbc.queryForObject("select count(*) from event_media", Integer.class)).isEqualTo(1);
        row = jdbc.queryForMap("select * from event_media where event_id=?", id);
        assertThat(row.get("snapshot_path")).isEqualTo("/storage/events/sample.jpg");
        assertThat(row.get("video_path")).isEqualTo("/storage/events/sample.mp4");
        assertThat(row.get("pre_seconds")).isEqualTo(5);
    }

    @Test void missingAndWrongKeysCannotWriteAndHealthStaysPublic() throws Exception {
        mvc.perform(post("/api/ai/events").contentType("application/json").content(EVENT))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/events").header("X-AI-API-KEY", "wrong")
            .contentType("application/json").content(EVENT)).andExpect(status().isUnauthorized());
        long id = createEvent();
        mvc.perform(patch("/api/ai/events/{id}/media", id).contentType("application/json").content(VIDEO))
            .andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("select video_path from event_media where event_id=?", String.class,id)).isNull();
        mvc.perform(post("/api/ai/unplanned").header("X-AI-API-KEY", "test-only-key"))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
        mvc.perform(get("/api/admin/workers").header("X-AI-API-KEY", "test-only-key"))
            .andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(401, 403));
    }

    @Test void unknownCameraDoesNotCreateRows() throws Exception {
        mvc.perform(post("/api/ai/events").header("X-AI-API-KEY", "test-only-key")
            .contentType("application/json").content(EVENT.replace("camera-1","unknown")))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("camera_NOT_FOUND"));
        assertThat(jdbc.queryForObject("select count(*) from fire_event", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from event_media", Integer.class)).isZero();
    }

    @Test void rejectsMalformedAndInvalidInput() throws Exception {
        for (String input : new String[]{"{}", "{", EVENT.replace("0.91","1.1"),
                EVENT.replace("SMOKE","UNKNOWN"), EVENT.replace("2026-10-07T14:30:25","not-a-date"),
                EVENT.replace("sample.jpg", "x".repeat(501))}) {
            mvc.perform(post("/api/ai/events").header("X-AI-API-KEY", "test-only-key")
                .contentType("application/json").content(input)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        assertThat(jdbc.queryForObject("select count(*) from fire_event", Integer.class)).isZero();
    }

    @Test void rejectsInvalidMediaAndUnknownEvent() throws Exception {
        long id = createEvent();
        mvc.perform(patch("/api/ai/events/{id}/media", id).header("X-AI-API-KEY", "test-only-key")
            .contentType("application/json").content(VIDEO.replace(":5", ":-1")))
            .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/ai/events/999999/media").header("X-AI-API-KEY", "test-only-key")
            .contentType("application/json").content(VIDEO)).andExpect(status().isNotFound());
    }

    @Test void createsOptionalMediaForExistingEventWithoutMedia() throws Exception {
        long id=createEvent();
        jdbc.update("delete from event_media where event_id=?", id);
        mvc.perform(patch("/api/ai/events/{id}/media",id).header("X-AI-API-KEY","test-only-key")
            .contentType("application/json").content(VIDEO)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from event_media where event_id=?",Integer.class,id)).isEqualTo(1);
    }

    @Test void mediaFailureRollsBackEventToo() {
        doThrow(new IllegalStateException("test storage failure")).when(media).save(any(EventMedia.class));
        assertThatThrownBy(() -> service.create(mapper.readValue(EVENT, com.firis.event.dto.CreateAiEventRequest.class)))
            .isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("select count(*) from fire_event",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from event_media",Integer.class)).isZero();
    }
}
