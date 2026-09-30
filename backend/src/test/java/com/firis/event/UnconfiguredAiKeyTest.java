package com.firis.event;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@EnabledIfEnvironmentVariable(named = "FIRIS_TEST_DB_URL", matches = ".+")
@SpringBootTest(properties = {"spring.config.import=", "AI_API_KEY=",
    "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
class UnconfiguredAiKeyTest {
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
    @Test void emptyConfigurationNeverAllowsAccess() throws Exception {
        mvc.perform(post("/api/ai/events").header("X-AI-API-KEY", ""))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/events").header("X-AI-API-KEY", "some-key"))
            .andExpect(status().isUnauthorized());
    }
}
