package com.firis.camera.config;

import com.firis.camera.dto.CreateCameraRequest;
import com.firis.camera.repository.CameraRepository;
import com.firis.camera.service.CameraService;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CameraInitializerTest {
    private final CameraRepository repository = mock(CameraRepository.class);
    private final CameraService service = mock(CameraService.class);

    @Test
    void createsNineCamerasWithConfiguredBaseUrl() {
        new CameraInitializer(repository, service, "https://firis.example:8443///").run(null);

        var requests = ArgumentCaptor.forClass(CreateCameraRequest.class);
        verify(service, times(9)).createCamera(requests.capture());
        assertThat(requests.getAllValues()).extracting(CreateCameraRequest::cameraId)
                .containsExactly("CAM001", "CAM002", "CAM003", "CAM004", "CAM005", "CAM006", "CAM007", "CAM008", "CAM009");
        for (var request : requests.getAllValues()) {
            assertThat(request.streamUrl()).isEqualTo(
                    "https://firis.example:8443/videos/" + request.cameraId() + "/001.mp4");
            assertThat(request.status()).isEqualTo("ONLINE");
        }
        verify(repository, never()).save(any());
    }

    @Test
    void preservesExistingCamerasAndDoesNotInsertAgainOnRestart() {
        Set<String> existing = new HashSet<>(Set.of("CAM001", "CAM002", "CAM003"));
        when(repository.existsById(anyString())).thenAnswer(call -> existing.contains(call.getArgument(0)));
        when(service.createCamera(any())).thenAnswer(call -> {
            CreateCameraRequest request = call.getArgument(0);
            assertThat(existing.add(request.cameraId())).isTrue();
            return null;
        });

        new CameraInitializer(repository, service, "http://localhost:8080").run(null);
        new CameraInitializer(repository, service, "https://changed.example").run(null);

        verify(service, times(1)).createCamera(argThat(request -> request.cameraId().equals("CAM004")
                && request.streamUrl().equals("http://localhost:8080/videos/CAM004/001.mp4")));
        assertThat(existing).containsExactlyInAnyOrder("CAM001", "CAM002", "CAM003", "CAM004", "CAM005", "CAM006", "CAM007", "CAM008", "CAM009");
        verify(repository, never()).save(any());
    }

    @Test
    void concurrentDuplicateIsSkippedAndRemainingCamerasAreRegistered() {
        when(service.createCamera(argThat(request -> request != null && request.cameraId().equals("CAM001"))))
                .thenThrow(new ApiException(ErrorCode.CAMERA_ALREADY_EXISTS));

        assertThatCode(() -> new CameraInitializer(repository, service, "http://localhost:8080").run(null))
                .doesNotThrowAnyException();
        verify(service).createCamera(argThat(request -> request.cameraId().equals("CAM004")));
    }

    @Test
    void unexpectedRegistrationFailureIsNotHidden() {
        when(service.createCamera(any())).thenThrow(new ApiException(ErrorCode.BAD_REQUEST));

        assertThatThrownBy(() -> new CameraInitializer(repository, service, "invalid-url").run(null))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST);
    }
}
