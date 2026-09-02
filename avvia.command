#!/bin/bash
# Avvia TCGDash su macOS/Linux: serve dist/ in locale e apre il browser.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js non trovato. Installalo da https://nodejs.org e riprova."
  read -r -p "Premi Invio per chiudere..."
  exit 1
fi
if [ ! -f dist/index.html ]; then
  echo "Cartella dist/ assente: la costruisco (npm install && npm run build)."
  npm install && npm run build || exit 1
fi
node scripts/serve.mjs "$1"
