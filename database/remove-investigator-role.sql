-- Migration: Remove Investigator role entirely from the DWBS system
-- Run against rammis_dwbs_db after backup.

USE `rammis_dwbs_db`;

-- 1. Remove Investigator from users.role ENUM
ALTER TABLE `users`
  MODIFY COLUMN `role`
    ENUM('Employee','Branch_Manager','Compliance_Officer','CEO','System_Admin','Auditor') NOT NULL;

-- 2. Remove Investigator from investigationnotes.sender_type ENUM
ALTER TABLE `investigationnotes`
  MODIFY COLUMN `sender_type`
    ENUM('Compliance_Officer','Reporter','CEO') NOT NULL;

-- 3. Remove Investigator from investigationnotes.audience_type ENUM
ALTER TABLE `investigationnotes`
  MODIFY COLUMN `audience_type`
    ENUM('General','Compliance_Officer','CEO','Reporter') NOT NULL DEFAULT 'General';

-- 4. Rename assigned_investigator column to assigned_handler
--    (Compliance Officers now handle assignment directly)
ALTER TABLE `cases`
  CHANGE `assigned_investigator` `assigned_handler` int(11) DEFAULT NULL;

-- 5. Delete any existing Investigator accounts (safe — no cases lost, FK set to NULL via cascade)
DELETE FROM `users` WHERE `role` = 'Investigator';
