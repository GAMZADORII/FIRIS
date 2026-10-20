package com.firis.event.controller;

import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import com.firis.event.repository.EventMediaRepository;
import com.firis.event.repository.FireEventRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/events")
public class EventMediaController {
    private final FireEventRepository events;
    private final EventMediaRepository media;
    private final Path storageRoot;

    public EventMediaController(FireEventRepository events, EventMediaRepository media,
            @Value("${app.event.storage-directory}") String storageDirectory) {
        this.events = events;
        this.media = media;
        storageRoot = Path.of(storageDirectory).toAbsolutePath().normalize();
    }

    @GetMapping(value = "/{eventId}/snapshot", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<Resource> snapshot(@PathVariable Long eventId) {
        return serve(eventId, "snapshot.jpg");
    }

    @GetMapping(value = "/{eventId}/video", produces = "video/mp4")
    public ResponseEntity<Resource> video(@PathVariable Long eventId) {
        return serve(eventId, "event.mp4");
    }

    @GetMapping(value = "/{eventId}/video/annotated", produces = "video/mp4")
    public ResponseEntity<Resource> annotatedVideo(@PathVariable Long eventId) {
        return serve(eventId, "event_annotated.mp4");
    }

    private ResponseEntity<Resource> serve(Long eventId, String fileName) {
        if (!events.existsById(eventId)) throw new ApiException(ErrorCode.EVENT_NOT_FOUND);
        var eventMedia = media.findByEvent_EventId(eventId).orElse(null);
        boolean video = !fileName.equals("snapshot.jpg");
        var storedPath = eventMedia == null ? null : video ? eventMedia.getVideoPath() : eventMedia.getSnapshotPath();
        if (storedPath == null || storedPath.isBlank()) throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        try {
            var root = storageRoot.toRealPath();
            var stored = Path.of(storedPath).toRealPath();
            if (!stored.getFileName().toString().equals(video ? "event.mp4" : "snapshot.jpg")) {
                throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
            }
            var path = video && fileName.equals("event_annotated.mp4")
                    ? stored.resolveSibling(fileName).toRealPath() : stored;
            if (!path.startsWith(root) || !Files.isRegularFile(path) || !Files.isReadable(path)
                    || !path.getFileName().toString().equals(fileName)) {
                throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
            }
            return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                    .contentType(video ? MediaType.parseMediaType("video/mp4") : MediaType.IMAGE_JPEG)
                    .body(new FileSystemResource(path));
        } catch (IOException | IllegalArgumentException error) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND);
        }
    }
}
