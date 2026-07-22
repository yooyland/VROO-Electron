@echo off
setlocal
cd /d "%~dp0"
title VROO Desktop Setup

echo ==========================================
echo   VROO Desktop Beta 1.0
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js LTS, then run this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found.
  pause
  exit /b 1
)

echo Installing Electron dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed.
  echo Check your internet connection and run this file again.
  pause
  exit /b 1
)

echo.
echo Starting VROO Desktop...
call npm start
