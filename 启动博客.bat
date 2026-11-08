@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Building the blog...
node build.mjs
if errorlevel 1 (
  echo.
  echo Build failed. Fix the error above, then run this file again.
  pause
  exit /b 1
)

echo.
echo   Starting local preview at http://127.0.0.1:4200
echo   Press Ctrl+C to stop.
echo.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4200'"
node serve.mjs
pause
