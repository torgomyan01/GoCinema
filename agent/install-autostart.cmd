@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
set "AGENT_DIR=%~dp0"
set "START_CMD=%AGENT_DIR%start.cmd"
cd /d "%AGENT_DIR%"

title GoCinema HDM Agent
echo.
echo GoCinema HDM Agent - install autostart and run
echo.

if not exist ".env" (
  echo ERROR: .env missing. Copy .env.example to .env first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

REM Create Startup shortcut via VBScript (no PowerShell)
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\GoCinema HDM Agent.lnk"
set "VBS=%TEMP%\gocinema-startup.vbs"

(
  echo Set oWS = WScript.CreateObject("WScript.Shell"^)
  echo Set oLink = oWS.CreateShortcut("%LNK%"^)
  echo oLink.TargetPath = "%START_CMD%"
  echo oLink.WorkingDirectory = "%AGENT_DIR%"
  echo oLink.WindowStyle = 7
  echo oLink.Description = "GoCinema HDM Agent"
  echo oLink.Save
) > "%VBS%"

cscript //nologo "%VBS%"
if errorlevel 1 (
  echo ERROR: Could not create Startup shortcut.
  del "%VBS%" 2>nul
  pause
  exit /b 1
)
del "%VBS%" 2>nul
echo [OK] Startup shortcut created.

REM Optional Task Scheduler (run as Administrator for this line)
schtasks /Create /TN "GoCinemaHdmAgent" /SC ONLOGON /RL LIMITED /F /TR "\"%START_CMD%\"" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo [OK] Task Scheduler entry created.
) else (
  echo [INFO] Task Scheduler skipped ^(optional^).
)

REM Start agent now if port 3100 is free
netstat -ano | findstr ":3100" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo [OK] Agent already running on port 3100.
) else (
  echo Starting agent...
  start "GoCinema HDM Agent" /MIN "%START_CMD%"
  timeout /t 2 /nobreak >nul
)

echo.
echo Check: http://127.0.0.1:3100/health
start "" "http://127.0.0.1:3100/health"
echo.
echo Done. Agent will start at Windows logon.
pause
