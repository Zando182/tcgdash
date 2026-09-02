@echo off
REM Avvia TCGDash: serve la dashboard in locale e apre il browser.
REM Serve Node.js installato (nodejs.org). Funziona anche su Windows ARM.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non trovato. Installalo da https://nodejs.org e riprova.
  pause
  exit /b 1
)
REM Alla prima esecuzione dist\ non c'e' ancora: si prepara da soli, cosi'
REM il doppio clic funziona anche appena scaricato il progetto.
if not exist "dist\index.html" (
  echo Prima accensione: preparo la dashboard, ci vuole un minuto...
  call npm install || goto :errore
  call npm run build || goto :errore
)
node scripts\serve.mjs %1
exit /b 0

:errore
echo.
echo Preparazione fallita. Apri il prompt in questa cartella e lancia:  npm install
pause
exit /b 1
