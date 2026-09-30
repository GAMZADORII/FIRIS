package com.firis.camera.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "CAMERA")
public class Camera {
    @Id @Column(name = "camera_id", length = 30)
    private String cameraId;
    @Column(name = "camera_name", nullable = false, length = 50)
    private String cameraName;
    @Column(length = 100)
    private String location;
    @Column(name = "stream_url", length = 500)
    private String streamUrl;
    @Column(nullable = false, length = 20)
    private String status;

    protected Camera() {}
    public String getCameraId() { return cameraId; }
}
