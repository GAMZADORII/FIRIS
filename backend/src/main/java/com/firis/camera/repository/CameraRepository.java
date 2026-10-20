package com.firis.camera.repository;

import com.firis.camera.entity.Camera;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CameraRepository extends JpaRepository<Camera, String> {
    List<Camera> findAllByDeletedFalse(Sort sort);
    boolean existsByCameraIdAndDeletedFalse(String cameraId);
}
