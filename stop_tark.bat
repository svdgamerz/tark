@echo off
title Stop Tark Background Process
echo Stopping Tark background process...
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*tark_background.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Tark has been stopped.
timeout /t 2 >nul
