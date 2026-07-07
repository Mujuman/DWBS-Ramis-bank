-- Set default admin password: Admin@Rammis2025!
-- bcrypt hash (rounds=12)
UPDATE users
SET password_hash = '$2b$12$KIXuMCWkMqCovUFvBn5m8.QzHVxvWPTfI.0W5ylQb2FZXmZsDI6/K'
WHERE username = 'sysadmin';
