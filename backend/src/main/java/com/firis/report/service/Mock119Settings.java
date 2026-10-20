package com.firis.report.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class Mock119Settings {
    private final String siteAddress;
    private final String controlRoomPhone;

    public Mock119Settings(
            @Value("${app.mock-119.site-address:}") String siteAddress,
            @Value("${app.mock-119.control-room-phone:}") String controlRoomPhone) {
        this.siteAddress = siteAddress == null ? "" : siteAddress.trim();
        this.controlRoomPhone = controlRoomPhone == null ? "" : controlRoomPhone.trim();
    }

    public String siteAddress() { return siteAddress; }
    public String controlRoomPhone() { return controlRoomPhone; }
}
