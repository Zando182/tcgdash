@echo off
REM Avvia TCGDash: serve la cartella dist/ in locale e apre il browser.
REM Serve Node.js installato (nodejs.org). Funziona anche su Windows ARM.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non trovato. Installalo da https://nodejs.org e riprova.
  echo In alternativa apri dist\index.html nel browser: funziona, ma senza salvataggio automatico.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Cartella dist\ assente. Lancia prima: npm install ^&^& npm run build
  pause
  exit /b 1
)
node scripts\serve.mjs %1
