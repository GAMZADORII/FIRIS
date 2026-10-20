package com.firis.report.websocket;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocket
@EnableScheduling
@ConditionalOnProperty(name = "app.mock-119.center-enabled", havingValue = "true")
public class Mock119CenterWebSocketConfig implements WebSocketConfigurer {
    private final Mock119CenterWebSocketHandler handler;
    private final String[] origins;
    public Mock119CenterWebSocketConfig(Mock119CenterWebSocketHandler handler,
            @Value("${app.mock-119.allowed-origins:http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173}") String[] origins) {
        this.handler = handler; this.origins = origins;
    }
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/mock-119-center").setAllowedOrigins(origins);
    }
}
