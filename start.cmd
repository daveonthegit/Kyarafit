@echo off
REM Kyarafit startup (Windows). Runs scripts\start.ps1 (stops existing processes first).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
pause
