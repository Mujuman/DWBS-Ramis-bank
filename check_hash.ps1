$mysql = "C:\xampp\mysql\bin\mysql.exe"
& $mysql -u root rammis_dwbs_db -e "SELECT username, role, IF(password_hash IS NOT NULL, 'SET', 'NULL') AS password_hash FROM users;"
