$mysql = "C:\xampp\mysql\bin\mysql.exe"
$sqlFile = "c:\Users\Teyba\Desktop\DWBS system\fix_sysadmin.sql"
Start-Process -FilePath $mysql -ArgumentList @("-u", "root", "rammis_dwbs_db") -RedirectStandardInput $sqlFile -Wait -NoNewWindow
Write-Output "Done"
