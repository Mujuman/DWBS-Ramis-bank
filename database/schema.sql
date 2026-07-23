-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 07, 2026 at 09:59 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `rammis_dwbs_db`
--
CREATE DATABASE IF NOT EXISTS `rammis_dwbs_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `rammis_dwbs_db`;

-- ── Application DB User & Audit User Setup ──────────────────
-- Create users if they do not exist
CREATE USER IF NOT EXISTS 'dwbs_app_user'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_APP_PASSWORD';
GRANT SELECT, INSERT, UPDATE ON `rammis_dwbs_db`.* TO 'dwbs_app_user'@'localhost';

CREATE USER IF NOT EXISTS 'dwbs_audit_user'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_AUDIT_PASSWORD';
GRANT INSERT ON `rammis_dwbs_db`.`auditlogs` TO 'dwbs_audit_user'@'localhost';

FLUSH PRIVILEGES;

-- --------------------------------------------------------

--
-- Table structure for table `anonymoussessions`
--

CREATE TABLE `anonymoussessions` (
  `session_id` int(11) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `captcha_verified` tinyint(1) DEFAULT 0,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditlogs`
--

CREATE TABLE `auditlogs` (
  `log_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `target_case_id` int(11) DEFAULT NULL,
  `details` text NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cases`
--

CREATE TABLE `cases` (
  `case_id` int(11) NOT NULL,
  `reference_id` varchar(50) NOT NULL,
  `verification_token` varchar(255) NOT NULL,
  `reporter_type` enum('Anonymous','Authenticated') NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `category` enum('Fraud','Corruption','Bribery','Abuse_of_Power','Procurement_Violation','System_Misuse') NOT NULL,
  `branch_or_dept` varchar(100) NOT NULL,
  `severity_level` enum('Low','Medium','High','Critical') DEFAULT 'Low',
  `description` text NOT NULL,
  `status` enum('New','Under_Review','Complaint_Dismissed','Assigned','Investigating','Pending_Evidence','Substantiated','Dismissed_No_Evidence') DEFAULT 'New',
  `assigned_handler` int(11) DEFAULT NULL,
  `is_escalated` tinyint(1) DEFAULT 0,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `anon_session_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evidencefiles`
--

CREATE TABLE `evidencefiles` (
  `file_id` int(11) NOT NULL,
  `case_id` int(11) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `encryption_iv` varchar(64) DEFAULT NULL,
  `uploaded_by` int(11) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `investigationnotes`
--

CREATE TABLE `investigationnotes` (
  `note_id` int(11) NOT NULL,
  `case_id` int(11) NOT NULL,
  `sender_type` enum('Compliance_Officer','Reporter','CEO') NOT NULL,
  `audience_type` enum('General','Compliance_Officer','CEO','Reporter') NOT NULL DEFAULT 'General',
  `note_text` text NOT NULL,
  `is_internal_only` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL COMMENT 'Local password hash (bcrypt) - only for initial sysadmin, NULL for AD users',
  `role` enum('Employee','Branch_Manager','Compliance_Officer','CEO','System_Admin','Auditor') NOT NULL,
  `department` varchar(100) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `anonymoussessions`
--
ALTER TABLE `anonymoussessions`
  ADD PRIMARY KEY (`session_id`),
  ADD UNIQUE KEY `session_token` (`session_token`);

--
-- Indexes for table `auditlogs`
--
ALTER TABLE `auditlogs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `target_case_id` (`target_case_id`);

--
-- Indexes for table `cases`
--
ALTER TABLE `cases`
  ADD PRIMARY KEY (`case_id`),
  ADD UNIQUE KEY `reference_id` (`reference_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `assigned_handler` (`assigned_handler`);

--
-- Indexes for table `evidencefiles`
--
ALTER TABLE `evidencefiles`
  ADD PRIMARY KEY (`file_id`),
  ADD KEY `case_id` (`case_id`),
  ADD KEY `uploaded_by` (`uploaded_by`);

--
-- Indexes for table `investigationnotes`
--
ALTER TABLE `investigationnotes`
  ADD PRIMARY KEY (`note_id`),
  ADD KEY `case_id` (`case_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `anonymoussessions`
--
ALTER TABLE `anonymoussessions`
  MODIFY `session_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auditlogs`
--
ALTER TABLE `auditlogs`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cases`
--
ALTER TABLE `cases`
  MODIFY `case_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `evidencefiles`
--
ALTER TABLE `evidencefiles`
  MODIFY `file_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `investigationnotes`
--
ALTER TABLE `investigationnotes`
  MODIFY `note_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `auditlogs`
--
ALTER TABLE `auditlogs`
  ADD CONSTRAINT `auditlogs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `auditlogs_ibfk_2` FOREIGN KEY (`target_case_id`) REFERENCES `cases` (`case_id`) ON DELETE SET NULL;

--
-- Constraints for table `cases`
--
ALTER TABLE `cases`
  ADD CONSTRAINT `cases_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `cases_ibfk_2` FOREIGN KEY (`assigned_handler`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `evidencefiles`
--
ALTER TABLE `evidencefiles`
  ADD CONSTRAINT `evidencefiles_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `cases` (`case_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `evidencefiles_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `investigationnotes`
--
ALTER TABLE `investigationnotes`
  ADD CONSTRAINT `investigationnotes_ibfk_1` FOREIGN KEY (`case_id`) REFERENCES `cases` (`case_id`) ON DELETE CASCADE;

--
-- INITIAL SEED DATA (System Admin accounts)
--
-- Default sysadmin password: Admin@Rammis2025!
-- Hash generated with bcrypt rounds=12
-- !! CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN !!
--
INSERT INTO `users`
  (`username`, `email`, `password_hash`, `role`, `department`, `is_active`)
VALUES
  (
    'sysadmin',
    'sysadmin@rammisbank.et',
    '$2a$12$g4Uf7j4fi4atlpbKnlJoheZAOVpGwk/9pZfZKCboEQjX2OT3IBCYK',
    'System_Admin',
    'IT_Security',
    1
  ),
  (
    'compliance.officer',
    'compliance@rammisbank.et',
    NULL,
    'Compliance_Officer',
    'Compliance',
    1
  ),
  (
    'ceo',
    'ceo@rammisbank.et',
    NULL,
    'CEO',
    'Executive',
    1
  ),
  (
    'auditor',
    'auditor@rammisbank.et',
    '$2a$12$g4Uf7j4fi4atlpbKnlJoheZAOVpGwk/9pZfZKCboEQjX2OT3IBCYK',
    'Auditor',
    'Internal_Audit',
    1
  );

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
