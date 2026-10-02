package com.firis.camera.controller;

import com.firis.camera.dto.CameraResponse;
import com.firis.camera.dto.CreateCameraRequest;
import com.firis.camera.service.CameraService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/cameras")
public class CameraController {

    private final CameraService cameraService;

    public CameraController(CameraService cameraService) {
        this.cameraService = cameraService;
    }

    @GetMapping
    public List<CameraResponse> getCameras() {
        return cameraService.getCameras();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CameraResponse createCamera(@Valid @RequestBody CreateCameraRequest request) {
        return cameraService.createCamera(request);
    }
}
