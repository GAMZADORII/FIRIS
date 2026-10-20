-- Local accounts requested by the project owner; passwords are BCrypt hashes.
-- Run 001-super-admin-role.sql first. Existing login IDs are never overwritten.
SET time_zone = '+09:00';
START TRANSACTION;
INSERT INTO account (login_id, password_hash, name, role, contact_phone, must_change_password, contact_onboarding_required, status, created_at, updated_at)
SELECT 'superadmin1', '$2b$10$YJF8X6PU7S52dK7ypPXbSO6mIK9.hdLxOgayOqpvRPTD2mOHbcrkS', '박상현', 'SUPER_ADMIN', '01012345678', FALSE, FALSE, 'ACTIVE', NOW(6), NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM account WHERE login_id = 'superadmin1');
INSERT INTO account (login_id, password_hash, name, role, contact_phone, must_change_password, contact_onboarding_required, status, created_at, updated_at)
SELECT 'superadmin2', '$2b$10$PtFckZojqc3dAQ096CUDReOmtPIhmhN6TI2vx6QblDRootTrxw9Ja', '차나래', 'SUPER_ADMIN', '01012345678', FALSE, FALSE, 'ACTIVE', NOW(6), NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM account WHERE login_id = 'superadmin2');
COMMIT;
