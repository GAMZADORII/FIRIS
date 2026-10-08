package com.firis.account.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "account")
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "account_id")
    private Long accountId;

    @Column(name = "login_id", nullable = false, unique = true, length = 30)
    private String loginId;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 50)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(name = "contact_consent_version", length = 30)
    private String contactConsentVersion;

    @Column(name = "contact_consented_at")
    private LocalDateTime contactConsentedAt;

    // NULL on pre-existing accounts means that the new onboarding rule was not applied to them.
    @Column(name = "contact_onboarding_required")
    private Boolean contactOnboardingRequired;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountStatus status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Account() {
    }

    private Account(
            String loginId,
            String passwordHash,
            String name,
            Role role,
            boolean mustChangePassword,
            AccountStatus status
    ) {
        this.loginId = loginId;
        this.passwordHash = passwordHash;
        this.name = name;
        this.role = role;
        this.mustChangePassword = mustChangePassword;
        this.status = status;
    }

    public static Account createAdmin(String loginId, String passwordHash, String name) {
        return new Account(loginId, passwordHash, name, Role.ADMIN, false, AccountStatus.ACTIVE);
    }

    public static Account createWorker(String loginId, String passwordHash, String name) {
        Account worker = new Account(loginId, passwordHash, name, Role.WORKER, true, AccountStatus.ACTIVE);
        worker.contactOnboardingRequired = true;
        return worker;
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
        this.mustChangePassword = false;
    }

    public void resetToTemporaryPassword(String passwordHash) {
        this.passwordHash = passwordHash;
        this.mustChangePassword = true;
    }

    public void completeContactOnboarding(String phone, String consentVersion, LocalDateTime consentedAt) {
        this.contactPhone = phone;
        this.contactConsentVersion = consentVersion;
        this.contactConsentedAt = consentedAt;
        this.contactOnboardingRequired = false;
    }

    public void changeStatus(AccountStatus status) {
        this.status = status;
    }

    public boolean isActive() {
        return status == AccountStatus.ACTIVE;
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getAccountId() { return accountId; }
    public String getLoginId() { return loginId; }
    public String getPasswordHash() { return passwordHash; }
    public String getName() { return name; }
    public Role getRole() { return role; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public boolean isContactOnboardingRequired() { return Boolean.TRUE.equals(contactOnboardingRequired); }
    public String getContactPhone() { return contactPhone; }
    public String getContactConsentVersion() { return contactConsentVersion; }
    public LocalDateTime getContactConsentedAt() { return contactConsentedAt; }
    public AccountStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
