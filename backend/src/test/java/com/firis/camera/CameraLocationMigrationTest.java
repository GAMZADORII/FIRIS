package com.firis.camera;

import com.firis.camera.entity.Camera;
import com.firis.camera.repository.CameraRepository;
import com.firis.camera.service.CameraService;
import jakarta.persistence.EntityManager;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class CameraLocationMigrationTest {
    private final CameraRepository repository = mock(CameraRepository.class);
    private final CameraService service = new CameraService(repository, mock(EntityManager.class));

    @Test
    void movesOnlyThePreviousDefaultLocation() {
        var camera = Camera.create("CAM003", "CCTV 03", "창고 A구역", null, "ONLINE");
        when(repository.findById("CAM003")).thenReturn(Optional.of(camera));

        assertThat(service.updateDefaultLocationIfUnchanged("CAM003", "창고 A구역", "공장 C구역")).isTrue();
        assertThat(camera.getLocation()).isEqualTo("공장 C구역");
        assertThat(service.updateDefaultLocationIfUnchanged("CAM003", "창고 A구역", "공장 C구역")).isFalse();
    }

    @Test
    void preservesAnEditedLocation() {
        var camera = Camera.create("CAM003", "CCTV 03", "제1공장 2층", null, "ONLINE");
        when(repository.findById("CAM003")).thenReturn(Optional.of(camera));

        assertThat(service.updateDefaultLocationIfUnchanged("CAM003", "창고 A구역", "공장 C구역")).isFalse();
        assertThat(camera.getLocation()).isEqualTo("제1공장 2층");
    }
}
