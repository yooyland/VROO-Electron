@echo off
setlocal
cd /d "%~dp0"
title VROO Desktop
if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron is not installed.
  echo Run 01_INSTALL_AND_RUN.cmd first.
  pause
  exit /b 1
)
call npm start
