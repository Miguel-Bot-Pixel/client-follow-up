@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Client Follow Up - demarrage local
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe sur cet ordinateur.
  echo.
  echo 1. Va sur https://nodejs.org
  echo 2. Telecharge et installe la version "LTS"
  echo 3. Relance ensuite ce fichier (start-windows.bat)
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Premiere utilisation : installation des dependances...
  echo ^(cette etape peut prendre une minute, ne ferme pas cette fenetre^)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo L'installation a echoue. Verifie ta connexion internet et relance ce fichier.
    pause
    exit /b 1
  )
  echo.
)

echo Demarrage du serveur...
echo IMPORTANT : laisse cette fenetre ouverte tant que tu utilises l'outil.
echo Le navigateur va s'ouvrir automatiquement dans quelques secondes.
echo.

start "" /min cmd /c "timeout /t 3 >nul && start http://localhost:3000/?desk=en"

call npm start

echo.
echo Le serveur s'est arrete.
pause
