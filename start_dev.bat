@echo off
title Tark Local Development Launcher
echo ========================================================
echo Starting Tark Development Servers...
echo ========================================================

echo [1/2] Launching Backend Server on port 8000...
start "Tark Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

timeout /t 2 >nul

echo [2/2] Launching Frontend Server on port 5173...
start "Tark Frontend (Vite + React)" cmd /k "cd /d "%~dp0frontend" && npm.cmd run dev"

echo.
echo ========================================================
echo Both servers are starting up:
echo   - Backend:  http://127.0.0.1:8000
echo   - Frontend: http://localhost:5173
echo ========================================================
echo.
pause
