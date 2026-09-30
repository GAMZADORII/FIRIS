package com.firis.event.dto;
import com.firis.event.entity.EventType;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
public record CreateAiEventRequest(
    @NotBlank @Size(max = 30) String cameraId,
    @NotNull EventType eventType,
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double confidence,
    @NotNull LocalDateTime detectedAt,
    @NotBlank @Size(max = 500) String snapshotPath,
    @Size(max = 50) String modelVersion
) {}
