@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "LOGFILE=%~dp0service.log"
set "NODE_EXE="

rem Cherche node.exe dans le PATH d'abord (fonctionne si Node est
rem reinstalle ou mis a jour ailleurs), sinon se rabat sur l'emplacement
rem d'installation standard.
for /f "delims=" %%N in ('where node 2^>nul') do (
  if not defined NODE_EXE set "NODE_EXE=%%N"
)
if not defined NODE_EXE (
  if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)

if not defined NODE_EXE (
  echo [%date% %time%] ERREUR : node.exe introuvable ^(ni dans le PATH, ni dans l'emplacement par defaut^) >> "%LOGFILE%"
  exit /b 1
)

echo [%date% %time%] Demarrage de GymOS avec %NODE_EXE% >> "%LOGFILE%"
"%NODE_EXE%" index.js >> "%LOGFILE%" 2>&1
echo [%date% %time%] Arret de GymOS ^(code %errorlevel%^) >> "%LOGFILE%"
