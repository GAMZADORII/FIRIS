-- MySQL: retain existing roles and add SUPER_ADMIN before inserting accounts.
ALTER TABLE account MODIFY COLUMN role ENUM('ADMIN', 'SUPER_ADMIN', 'WORKER') NOT NULL;
