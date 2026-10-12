package com.firis.report.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.*;

@Component
public class Mock119CenterWebSocketHandler extends TextWebSocketHandler {
    private final ObjectMapper mapper;
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    public Mock119CenterWebSocketHandler(ObjectMapper mapper) { this.mapper = mapper; }
    @Override public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), new ConcurrentWebSocketSessionDecorator(session, 5000, 65536));
    }
    @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
    }
    @Override public void handleTransportError(WebSocketSession session, Throwable error) throws IOException {
        sessions.remove(session.getId());
        session.close(CloseStatus.SERVER_ERROR);
    }
    @Override protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        // State changes only through validated HTTP APIs. Keep idle connections alive.
        if ("PING".equals(message.getPayload())) {
            var safe = sessions.get(session.getId());
            if (safe != null && safe.isOpen()) safe.sendMessage(new TextMessage("PONG"));
        }
    }
    @TransactionalEventListener
    public void broadcast(Mock119CenterNotification event) {
        final TextMessage message;
        try { message = new TextMessage(mapper.writeValueAsString(event)); }
        catch (IOException error) { return; }
        sessions.forEach((id, session) -> {
            try {
                if (session.isOpen()) session.sendMessage(message);
                else sessions.remove(id);
            } catch (IOException | RuntimeException error) {
                sessions.remove(id);
                try { session.close(CloseStatus.SERVER_ERROR); } catch (IOException ignored) { }
            }
        });
    }
}
