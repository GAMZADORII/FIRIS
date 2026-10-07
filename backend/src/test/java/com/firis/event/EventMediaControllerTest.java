package com.firis.event;

import com.firis.common.exception.ApiException;
import com.firis.event.controller.EventMediaController;
import com.firis.event.entity.EventMedia;
import com.firis.event.repository.EventMediaRepository;
import com.firis.event.repository.FireEventRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class EventMediaControllerTest {
    @TempDir Path root;

    @Test void servesOnlyRecordedFilesInsideEventStorage() throws Exception {
        var events = mock(FireEventRepository.class);
        var media = mock(EventMediaRepository.class);
        var row = mock(EventMedia.class);
        when(events.existsById(7L)).thenReturn(true);
        when(media.findByEvent_EventId(7L)).thenReturn(Optional.of(row));
        var eventFolder = Files.createDirectory(root.resolve("event-1"));
        var snapshot = Files.writeString(eventFolder.resolve("snapshot.jpg"), "jpeg");
        var controller = new EventMediaController(events, media, root.toString());
        when(row.getSnapshotPath()).thenReturn(snapshot.toString());
        assertThat(controller.snapshot(7L).getStatusCode().value()).isEqualTo(200);

        var outside = Files.createTempFile("firis-outside-", ".jpg");
        when(row.getSnapshotPath()).thenReturn(outside.toString());
        assertThatThrownBy(() -> controller.snapshot(7L)).isInstanceOf(ApiException.class);
    }

    @Test void servesAnnotatedVideoOnlyBesideRecordedOriginal() throws Exception {
        var events = mock(FireEventRepository.class);
        var media = mock(EventMediaRepository.class);
        var row = mock(EventMedia.class);
        when(events.existsById(8L)).thenReturn(true);
        when(media.findByEvent_EventId(8L)).thenReturn(Optional.of(row));
        var folder = Files.createDirectory(root.resolve("event-2"));
        var original = Files.writeString(folder.resolve("event.mp4"), "original");
        var annotated = Files.writeString(folder.resolve("event_annotated.mp4"), "annotated");
        when(row.getVideoPath()).thenReturn(original.toString());
        var controller = new EventMediaController(events, media, root.toString());
        assertThat(controller.annotatedVideo(8L).getBody().getFile().toPath()).isEqualTo(annotated);
        Files.delete(annotated);
        assertThatThrownBy(() -> controller.annotatedVideo(8L)).isInstanceOf(ApiException.class);
    }
}
