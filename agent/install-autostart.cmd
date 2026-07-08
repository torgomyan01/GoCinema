@echo off
REM Optional helper: create a Task Scheduler entry that runs agent at logon.
REM Run once as Administrator from the agent folder.

set AGENT_DIR=%~dp0
schtasks /Create /TN "GoCinemaHdmAgent" /SC ONLOGON /RL HIGHEST /F /TR "\"%AGENT_DIR%start.cmd\""
if %ERRORLEVEL% EQU 0 (
  echo Task "GoCinemaHdmAgent" created. Agent will start at Windows logon.
) else (
  echo Failed. Run this file as Administrator.
)
pause
