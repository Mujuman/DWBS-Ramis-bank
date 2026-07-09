-- Migration: Allow Compliance Team Lead messages to be separated from Investigator notes

ALTER TABLE `investigationnotes`
  MODIFY `sender_type` enum('Investigator','Compliance_Officer','Reporter') NOT NULL;
