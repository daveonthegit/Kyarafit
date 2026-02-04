@echo off
REM Kyarafit startup (Windows). Runs scripts\start.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
