package com.firis.camera.service;

import com.firis.camera.dto.CameraResponse;
import com.firis.camera.dto.CreateCameraRequest;
import com.firis.camera.entity.Camera;
import com.firis.camera.repository.CameraRepository;
import com.firis.common.exception.ApiException;
import com.firis.common.exception.ErrorCode;
import jakarta.persistence.EntityExistsException;
import jakarta.persistence.EntityManager;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.net.URI;

@Service
public class CameraService {

    private final CameraRepository cameraRepository;
    private final EntityManager entityManager;

    public CameraService(CameraRepository cameraRepository, EntityManager entityManager) {
        this.cameraRepository = cameraRepository;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public List<CameraResponse> getCameras() {
        return cameraRepository.findAll(Sort.by("cameraId")).stream()
                .map(CameraResponse::from)
                .toList();
    }

    @Transactional
    public CameraResponse createCamera(CreateCameraRequest request) {
        validateStreamUrl(request.streamUrl());
        if (cameraRepository.existsById(request.cameraId())) {
            throw new ApiException(ErrorCode.CAMERA_ALREADY_EXISTS);
        }
        Camera camera = Camera.create(request.cameraId(), request.cameraName(),
                request.location(), request.streamUrl(), request.status(), request.reportNote());
        try {
            // Persist rather than merge: concurrent registration must never replace an existing camera.
            entityManager.persist(camera);
            entityManager.flush();
        } catch (EntityExistsException e) {
            throw new ApiException(ErrorCode.CAMERA_ALREADY_EXISTS);
        } catch (ConstraintViolationException e) {
            if (e.getSQLException().getErrorCode() == 1062) {
                throw new ApiException(ErrorCode.CAMERA_ALREADY_EXISTS);
            }
            throw e;
        }
        return CameraResponse.from(camera);
    }

    private void validateStreamUrl(String streamUrl) {
        try {
            URI uri = URI.create(streamUrl);
            if (!List.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getFragment() != null
                    || uri.getPort() > 65535 || uri.getPort() < -1) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "영상 주소는 유효한 HTTP 또는 HTTPS URL이어야 합니다.");
        }
    }
}
