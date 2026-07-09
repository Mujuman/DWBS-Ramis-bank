-- Migration: Separate reporter conversations for Investigator and Compliance Team Lead

ALTER TABLE `investigationnotes`
  ADD COLUMN `audience_type` enum('General','Investigator','Compliance_Officer') NOT NULL DEFAULT 'General'
  AFTER `sender_type`;
