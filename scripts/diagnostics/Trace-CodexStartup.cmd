@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Trace-CodexStartup.ps1" %*
pause
