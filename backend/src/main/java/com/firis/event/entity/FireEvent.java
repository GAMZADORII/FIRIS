package com.firis.event.entity;

import com.firis.camera.entity.Camera;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "FIRE_EVENT")
public class FireEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_id")
    private Long eventId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "camera_id", nullable = false)
    private Camera camera;
    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 20)
    private EventType eventType;
    @Column(nullable = false)
    private double confidence;
    @Column(name = "detected_at", nullable = false)
    private LocalDateTime detectedAt;
    @Column(name = "model_version", length = 50)
    private String modelVersion;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected FireEvent() {}
    public FireEvent(Camera camera, EventType eventType, double confidence,
            LocalDateTime detectedAt, String modelVersion, LocalDateTime createdAt) {
        this.camera = camera; this.eventType = eventType; this.confidence = confidence;
        this.detectedAt = detectedAt; this.modelVersion = modelVersion; this.createdAt = createdAt;
    }
    public Long getEventId() { return eventId; }
}
