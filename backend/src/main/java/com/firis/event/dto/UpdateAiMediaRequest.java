package com.firis.event.dto;
import jakarta.validation.constraints.*;
public record UpdateAiMediaRequest(
    @NotBlank @Size(max = 500) String videoPath,
    @NotNull @Min(0) Integer preSeconds,
    @NotNull @Min(0) Integer postSeconds
) {}
