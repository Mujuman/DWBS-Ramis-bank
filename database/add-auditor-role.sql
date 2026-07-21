-- Migration: Add Auditor role to existing database
-- Run this on your existing database to add the Auditor role

USE `rammis_dwbs_db`;

-- Step 1: Modify the users table role enum to include 'Auditor'
ALTER TABLE `users` 
  MODIFY `role` enum('Employee','Branch_Manager','Investigator','Compliance_Officer','CEO','System_Admin','Auditor') NOT NULL;

-- Step 2: Insert the default auditor account
-- Password: Admin@Rammis2025! (same as sysadmin for testing)
INSERT INTO `users` 
  (`username`, `email`, `password_hash`, `role`, `department`, `is_active`)
VALUES
  (
    'auditor',
    'auditor@rammisbank.et',
    '$2a$12$g4Uf7j4fi4atlpbKnlJoheZAOVpGwk/9pZfZKCboEQjX2OT3IBCYK',
    'Auditor',
    'Internal_Audit',
    1
  )
ON DUPLICATE KEY UPDATE
  password_hash = '$2a$12$g4Uf7j4fi4atlpbKnlJoheZAOVpGwk/9pZfZKCboEQjX2OT3IBCYK',
  role = 'Auditor',
  department = 'Internal_Audit',
  is_active = 1;

SELECT 'Auditor role added successfully!' AS status;
