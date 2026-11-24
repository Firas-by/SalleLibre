@echo off
title SalleLibre - Lancement de la Demonstration MVP
echo =========================================================
echo   SALLELIBRE - Systeme de Reperage des Salles Libres
echo   Lancement de la Demonstration Complete (MVP Production)
echo =========================================================
echo.

cd /d "%~dp0backend"

echo [1/3] Verification de l'environnement Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Erreur : Node.js n'est pas installe ou accessible dans le PATH.
    pause
    exit /b 1
)

echo [2/3] Initialisation du jeu de donnees de demonstration enrichi...
node src/database/seed_demo.js

echo.
echo [3/3] Demarrage du serveur Node.js et du client Web integre...
echo Le service sera disponible sur : http://localhost:3005
echo.
start http://localhost:3005

node src/server.js
pause
