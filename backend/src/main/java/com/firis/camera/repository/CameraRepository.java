package com.firis.camera.repository;
import com.firis.camera.entity.Camera;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CameraRepository extends JpaRepository<Camera, String> {}
