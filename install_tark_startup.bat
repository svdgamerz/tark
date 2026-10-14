@echo off
title Install Tark on Windows Startup
echo Creating Tark auto-start shortcut in Windows Startup folder...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Startup') + '\TarkAssistant.lnk'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '""C:\Users\shishir\OneDrive\Documents\tark\start_tark_background.vbs""'; $s.WorkingDirectory = 'C:\Users\shishir\OneDrive\Documents\tark'; $s.Save()"
echo Tark will now start automatically whenever your PC turns on!
pause
