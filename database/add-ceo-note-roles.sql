-- Migration: Add CEO to investigationnotes sender_type and audience_type ENUMs
-- Required for CEO <-> Ethics & Anti-Corruption Office chat to function.
-- Run against rammis_dwbs_db after backup.

USE `rammis_dwbs_db`;

-- Allow CEO to appear as message sender
ALTER TABLE `investigationnotes`
  MODIFY COLUMN `sender_type`
    ENUM('Investigator', 'Compliance_Officer', 'Reporter', 'CEO') NOT NULL;

-- Allow CEO to appear as message audience/recipient
ALTER TABLE `investigationnotes`
  MODIFY COLUMN `audience_type`
    ENUM('General', 'Investigator', 'Compliance_Officer', 'CEO', 'Reporter') NOT NULL DEFAULT 'General';
