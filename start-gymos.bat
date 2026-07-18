@echo off
cd /d "%~dp0server"
start "GymOS Server" cmd /k node index.js
timeout /t 2 /nobreak >nul
start "" http://localhost:4600/login.html
