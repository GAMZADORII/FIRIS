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

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

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

    public static Account createSuperAdmin(String loginId, String passwordHash, String name) {
        Account account = new Account(loginId, passwordHash, name, Role.SUPER_ADMIN, false, AccountStatus.ACTIVE);
        account.contactOnboardingRequired = false;
        return account;
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

    public boolean fillMissingContactPhone(String phone) {
        if (contactPhone != null && !contactPhone.isBlank()) return false;
        if (phone == null || !phone.trim().matches("^0\\d{1,2}-?\\d{3,4}-?\\d{4}$")) {
            throw new IllegalArgumentException("기본 연락처 형식을 확인해주세요.");
        }
        contactPhone = phone.trim().replace("-", "");
        return true;
    }

    public void completeContactOnboarding(String phone, String consentVersion, LocalDateTime consentedAt) {
        this.contactPhone = phone;
        this.contactConsentVersion = consentVersion;
        this.contactConsentedAt = consentedAt;
        this.contactOnboardingRequired = false;
    }

    public void changeRole(Role role) {
        if (this.role == Role.SUPER_ADMIN || role == null || role == Role.SUPER_ADMIN) {
            throw new IllegalArgumentException("작업자와 관리자 사이에서만 권한을 변경할 수 있습니다.");
        }
        if (this.role == role) return;
        this.role = role;
        this.contactOnboardingRequired = role == Role.WORKER && contactConsentedAt == null;
    }

    public void changeStatus(AccountStatus status) {
        this.status = status;
    }

    public boolean isActive() {
        return deletedAt == null && status == AccountStatus.ACTIVE;
    }

    public boolean isDeleted() { return deletedAt != null; }

    public void delete() {
        deletedAt = LocalDateTime.now();
        status = AccountStatus.INACTIVE;
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
