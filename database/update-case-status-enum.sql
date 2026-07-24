-- Update case status ENUM to match the application workflow
-- Remove old statuses (Complaint_Dismissed, Assigned) and ensure all current statuses are present

ALTER TABLE `cases` 
  MODIFY COLUMN `status` 
  ENUM('New','Under_Review','Investigating','Pending_Evidence','Substantiated','Dismissed_No_Evidence') 
  DEFAULT 'New';

-- Verify the change
SHOW COLUMNS FROM cases LIKE 'status';
