package com.firis.event.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "EVENT_MEDIA")
public class EventMedia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "media_id")
    private Long mediaId;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false, unique = true)
    private FireEvent event;
    @Column(name = "snapshot_path", length = 500)
    private String snapshotPath;
    @Column(name = "video_path", length = 500)
    private String videoPath;
    @Column(name = "pre_seconds")
    private Integer preSeconds;
    @Column(name = "post_seconds")
    private Integer postSeconds;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected EventMedia() {}
    public EventMedia(FireEvent event, String snapshotPath, LocalDateTime now) {
        this.event = event; this.snapshotPath = snapshotPath;
        this.createdAt = now; this.updatedAt = now;
    }
    public void updateVideo(String path, int pre, int post, LocalDateTime now) {
        videoPath = path; preSeconds = pre; postSeconds = post; updatedAt = now;
    }
    public String getSnapshotPath() { return snapshotPath; }
    public String getVideoPath() { return videoPath; }
    public Integer getPreSeconds() { return preSeconds; }
    public Integer getPostSeconds() { return postSeconds; }
}
