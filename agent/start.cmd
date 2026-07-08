@echo off
cd /d "%~dp0"
title GoCinema HDM Agent
echo Starting GoCinema HDM Agent...
if not exist ".env" (
  echo ERROR: .env missing. Copy .env.example to .env and fill values.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)
call npm start
pause
