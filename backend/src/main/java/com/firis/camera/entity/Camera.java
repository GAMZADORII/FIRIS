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
    public static Camera create(String cameraId, String cameraName, String location, String streamUrl, String status) {
        Camera camera = new Camera();
        camera.cameraId = cameraId;
        camera.cameraName = cameraName;
        camera.location = location;
        camera.streamUrl = streamUrl;
        camera.status = status;
        return camera;
    }
    public String getCameraId() { return cameraId; }
    public String getCameraName() { return cameraName; }
    public String getLocation() { return location; }
    public String getStreamUrl() { return streamUrl; }
    public String getStatus() { return status; }
}
