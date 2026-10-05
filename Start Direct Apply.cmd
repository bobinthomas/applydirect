@echo off
rem Double-click to start the app, open the inbox, and pull + rank today's jobs.
cd /d "%~dp0"
start "Direct Apply - keep this window open" cmd /k npm run dev
call npm run daily -- --open
echo.
pause
