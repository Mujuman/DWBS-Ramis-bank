-- Set default admin password: Admin@Rammis2025!
-- bcrypt hash (rounds=12)
UPDATE users
SET password_hash = '$2a$12$g4Uf7j4fi4atlpbKnlJoheZAOVpGwk/9pZfZKCboEQjX2OT3IBCYK'
WHERE username = 'sysadmin';
