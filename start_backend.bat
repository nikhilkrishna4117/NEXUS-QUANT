@echo off
title AI Trading Platform — Backend
cd /d "%~dp0"
echo ============================================================
echo  AI Algorithmic Trading Platform — Backend (FastAPI)
echo  API: http://localhost:8000
echo  Docs: http://localhost:8000/docs
echo ============================================================
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
