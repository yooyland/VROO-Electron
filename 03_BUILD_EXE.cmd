@echo off
setlocal
cd /d "%~dp0"
title Build VROO EXE

if not exist "node_modules\electron\dist\electron.exe" (
  echo Dependencies are not installed.
  echo Run 01_INSTALL_AND_RUN.cmd first.
  pause
  exit /b 1
)

echo Building Windows installer and portable EXE...
call npm run build:win
if errorlevel 1 (
  echo.
  echo BUILD FAILED.
  pause
  exit /b 1
)

echo.
echo BUILD COMPLETE.
echo Output folder:
echo %~dp0dist
start "" "%~dp0dist"
pause
