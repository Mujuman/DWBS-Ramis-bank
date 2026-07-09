-- Migration: Align case statuses with compliance workflow (A&RC procedure)
-- Run against existing rammis_dwbs_db after backup

USE `rammis_dwbs_db`;

-- Migrate legacy terminal statuses before altering enum
UPDATE `cases` SET `status` = 'Substantiated' WHERE `status` = 'Resolved';
UPDATE `cases` SET `status` = 'Dismissed_No_Evidence' WHERE `status` = 'Closed';

ALTER TABLE `cases`
  MODIFY COLUMN `status` enum(
    'New',
    'Under_Review',
    'Complaint_Dismissed',
    'Assigned',
    'Investigating',
    'Pending_Evidence',
    'Substantiated',
    'Dismissed_No_Evidence'
  ) NOT NULL DEFAULT 'New';
