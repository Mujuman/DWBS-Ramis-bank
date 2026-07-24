$mysql = "C:\xampp\mysql\bin\mysql.exe"
$sqlFile = "c:\Users\Teyba\Desktop\DWBS system\database\update-case-status-enum.sql"

# Run MySQL command
& $mysql -u root rammis_dwbs_db -e "ALTER TABLE cases MODIFY COLUMN status ENUM('New','Under_Review','Investigating','Pending_Evidence','Substantiated','Dismissed_No_Evidence') DEFAULT 'New';"

Write-Output "Database status ENUM updated successfully!"
