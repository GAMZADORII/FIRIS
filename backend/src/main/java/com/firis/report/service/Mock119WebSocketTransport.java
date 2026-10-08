package com.firis.report.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class Mock119WebSocketTransport implements Mock119Transport {
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper;
    private final String wsUrl;
    private final String apiKey;

    public Mock119WebSocketTransport(ObjectMapper mapper,
            @Value("${app.mock-119.ws-url:}") String wsUrl,
            @Value("${app.mock-119.api-key:}") String apiKey) {
        this.mapper = mapper;
        this.wsUrl = wsUrl;
        this.apiKey = apiKey;
    }

    @Override
    public String sendAndAwaitReceipt(Mock119Message message) {
        if (wsUrl == null || wsUrl.isBlank()) {
            throw new Mock119DeliveryException("119 모의서버 주소가 설정되지 않았습니다.");
        }
        CompletableFuture<String> reply = new CompletableFuture<>();
        WebSocket socket = null;
        try {
            var builder = client.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(5));
            if (apiKey != null && !apiKey.isBlank()) {
                builder.header("X-MOCK-119-KEY", apiKey);
            }
            socket = builder.buildAsync(URI.create(wsUrl), new WebSocket.Listener() {
                private final StringBuilder text = new StringBuilder();

                @Override public void onOpen(WebSocket webSocket) { webSocket.request(1); }

                @Override public java.util.concurrent.CompletionStage<?> onText(
                        WebSocket webSocket, CharSequence data, boolean last) {
                    text.append(data);
                    if (last) reply.complete(text.toString());
                    else webSocket.request(1);
                    return null;
                }

                @Override public java.util.concurrent.CompletionStage<?> onClose(
                        WebSocket webSocket, int statusCode, String reason) {
                    reply.completeExceptionally(new IllegalStateException("모의서버가 응답 없이 연결을 종료했습니다."));
                    return null;
                }

                @Override public void onError(WebSocket webSocket, Throwable error) {
                    reply.completeExceptionally(error);
                }
            }).get(5, TimeUnit.SECONDS);
            socket.sendText(mapper.writeValueAsString(message), true).get(5, TimeUnit.SECONDS);
            JsonNode ack = mapper.readTree(reply.get(5, TimeUnit.SECONDS));
            if (!"REPORT_ACK".equals(ack.path("type").asText())
                    || !message.requestId().equals(ack.path("requestId").asText())) {
                throw new Mock119DeliveryException("모의서버 확인 응답이 요청과 일치하지 않습니다.");
            }
            if (!"ACCEPTED".equals(ack.path("status").asText())) {
                throw new Mock119DeliveryException("모의서버가 신고를 거절했습니다.");
            }
            String receiptId = ack.path("receiptId").asText();
            if (receiptId.isBlank() || receiptId.length() > 100) {
                throw new Mock119DeliveryException("모의서버 접수 ID가 올바르지 않습니다.");
            }
            return receiptId;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new Mock119DeliveryException("모의 신고 전송이 중단되었습니다.", error);
        } catch (Mock119DeliveryException error) {
            throw error;
        } catch (Exception error) {
            throw new Mock119DeliveryException("모의서버 연결 또는 확인 응답에 실패했습니다.", error);
        } finally {
            if (socket != null) socket.sendClose(WebSocket.NORMAL_CLOSURE, "done");
        }
    }
}
