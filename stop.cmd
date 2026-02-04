@echo off
REM Kyarafit stop (Windows). Runs scripts\stop.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1" %*
