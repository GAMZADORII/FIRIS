-- Only needed when schema updates are managed manually (DDL_AUTO is not update).
ALTER TABLE CAMERA ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
