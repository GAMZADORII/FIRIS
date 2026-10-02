package com.firis.camera.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateCameraRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,30}") String cameraId,
        @NotBlank @Size(max = 50) String cameraName,
        @Size(max = 100) String location,
        @NotBlank @Size(max = 500)
        @Pattern(regexp = "https?://[^\\s]+") String streamUrl,
        @NotBlank @Pattern(regexp = "ONLINE|OFFLINE") String status
) {
}
