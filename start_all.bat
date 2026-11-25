@echo off
title AI Trading Platform — Launcher
cd /d "%~dp0"
echo ============================================================
echo   Starting AI Trading & Research Platform...
echo ============================================================
echo Starting Backend (FastAPI on Port 8000)...
start "Nexus Quant — Backend" cmd /k "%~dp0start_backend.bat"
timeout /t 3 /nobreak >nul
echo Starting Frontend (Vite on Port 5173)...
start "Nexus Quant — Frontend" cmd /k "%~dp0start_frontend.bat"
echo.
echo ============================================================
echo  Both services launched!
echo  - Frontend UI:  http://localhost:5173
echo  - Backend API:  http://localhost:8000
echo  - Swagger Docs: http://localhost:8000/docs
echo ============================================================
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:5173
