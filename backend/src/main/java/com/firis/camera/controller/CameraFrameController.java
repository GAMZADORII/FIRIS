package com.firis.camera.controller;

import com.firis.camera.repository.CameraRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cameras")
public class CameraFrameController {
    private final CameraRepository cameras;
    private final String aiServerUrl;
    private final String aiApiKey;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();

    public CameraFrameController(CameraRepository cameras,
            @Value("${AI_SERVER_URL:http://127.0.0.1:8000}") String aiServerUrl,
            @Value("${AI_API_KEY:}") String aiApiKey) {
        this.cameras = cameras;
        this.aiServerUrl = aiServerUrl.replaceAll("/+$", "");
        this.aiApiKey = aiApiKey;
    }

    @GetMapping(value = "/{cameraId}/frame", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> frame(@PathVariable String cameraId) {
        if (!cameraId.matches("[A-Za-z0-9_-]{1,30}") || !cameras.existsById(cameraId)) {
            return ResponseEntity.notFound().build();
        }
        if (aiApiKey.isBlank()) {
            return ResponseEntity.status(503).build();
        }
        var request = HttpRequest.newBuilder(URI.create(aiServerUrl + "/cameras/" + cameraId + "/frame"))
                .timeout(Duration.ofSeconds(3))
                .header("X-AI-API-KEY", aiApiKey)
                .GET().build();
        try {
            var upstream = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (upstream.statusCode() == 200) {
                return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                        .contentType(MediaType.IMAGE_JPEG).body(upstream.body());
            }
            if (upstream.statusCode() == 404) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.status(503).build();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(503).build();
        } catch (Exception error) {
            return ResponseEntity.status(503).build();
        }
    }
}
