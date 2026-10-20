package com.firis.account.entity;

public enum Role {
    SUPER_ADMIN,
    ADMIN,
    WORKER;

    public boolean isAdministrator() {
        return this == SUPER_ADMIN || this == ADMIN;
    }
}
