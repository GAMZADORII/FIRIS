package com.firis.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.firis.report.service.Mock119Message;
import com.firis.report.service.Mock119WebSocketTransport;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class Mock119WebSocketTransportTest {
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void sendsReportAndAcceptsMatchingReceiptOverWebSocket() throws Exception {
        try (var server = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            var received = CompletableFuture.supplyAsync(() -> receiveAndAcknowledge(server));
            var transport = new Mock119WebSocketTransport(mapper,
                    "ws://127.0.0.1:" + server.getLocalPort() + "/ws/reports", "test-key");
            var message = new Mock119Message("FIRE_REPORT", "test-request-id", 27L, "CAM003",
                    "창고 A구역", "FIRE", LocalDateTime.of(2026, 10, 8, 14, 2),
                    "W000001", "홍길동", "01012345678", "0212345678");

            assertThat(transport.sendAndAwaitReceipt(message)).isEqualTo("MOCK-119-001");
            assertThat(received.get(5, TimeUnit.SECONDS)).contains("\"reporterPhone\":\"01012345678\"");
        }
    }

    private String receiveAndAcknowledge(ServerSocket server) {
        try (var socket = server.accept()) {
            socket.setSoTimeout(5000);
            InputStream input = socket.getInputStream();
            StringBuilder headers = new StringBuilder();
            while (!headers.toString().endsWith("\r\n\r\n")) {
                int next = input.read();
                if (next < 0) throw new IllegalStateException("handshake ended early");
                headers.append((char) next);
            }
            assertThat(headers.toString()).contains("X-MOCK-119-KEY: test-key");
            String key = headers.toString().lines()
                    .filter(line -> line.toLowerCase().startsWith("sec-websocket-key:"))
                    .findFirst().orElseThrow().split(":", 2)[1].trim();
            String accept = Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1")
                    .digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
                            .getBytes(StandardCharsets.US_ASCII)));
            socket.getOutputStream().write(("HTTP/1.1 101 Switching Protocols\r\n"
                    + "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                    + "Sec-WebSocket-Accept: " + accept + "\r\n\r\n")
                    .getBytes(StandardCharsets.US_ASCII));
            socket.getOutputStream().flush();

            int first = input.read();
            int second = input.read();
            if (first != 0x81 || (second & 0x80) == 0) throw new IllegalStateException("invalid text frame");
            long length = second & 0x7f;
            if (length == 126) length = ((long) input.read() << 8) | input.read();
            if (length > 65535) throw new IllegalStateException("test frame too large");
            byte[] mask = input.readNBytes(4);
            byte[] data = input.readNBytes((int) length);
            for (int i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
            String request = new String(data, StandardCharsets.UTF_8);
            String requestId = mapper.readTree(request).path("requestId").asText();
            String ack = "{\"type\":\"REPORT_ACK\",\"requestId\":\"" + requestId
                    + "\",\"status\":\"ACCEPTED\",\"receiptId\":\"MOCK-119-001\"}";
            byte[] reply = ack.getBytes(StandardCharsets.UTF_8);
            socket.getOutputStream().write(new byte[]{(byte) 0x81, (byte) reply.length});
            socket.getOutputStream().write(reply);
            socket.getOutputStream().flush();
            return request;
        } catch (Exception error) {
            throw new RuntimeException(error);
        }
    }
}
