#!/usr/bin/env node
/**
 * Lancia uno script Python con il primo interprete disponibile.
 *
 * Serve perche' il comando giusto cambia da macchina a macchina: su molti Mac
 * e Linux esiste solo `python3`, su Windows di solito `python` o `py`. Senza
 * questo, `npm run ingest` funzionerebbe su un PC e non sull'altro.
 *
 *   node scripts/py.mjs ingest_xlsx.py [argomenti...]
 */
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const INTERPRETI = ['python3', 'python', 'py']
const CARTELLA = import.meta.dirname

const [script, ...argomenti] = process.argv.slice(2)
if (!script) {
  console.error('Uso: node scripts/py.mjs <script.py> [argomenti...]')
  process.exit(2)
}

function prova(candidati) {
  const [cmd, ...resto] = candidati
  if (!cmd) {
    console.error(
      'Python non trovato. Installa Python 3 da https://python.org e poi:  pip install openpyxl',
    )
    process.exit(1)
  }
  const proc = spawn(cmd, [resolve(CARTELLA, script), ...argomenti], {
    cwd: resolve(CARTELLA, '..'),
    stdio: 'inherit',
  })
  // Un comando inesistente emette sia "error" sia "close": senza questo flag
  // si vedrebbe un falso errore prima ancora di provare l'interprete dopo.
  let avviato = true
  proc.on('error', () => {
    avviato = false
    prova(resto)
  })
  proc.on('close', (code) => {
    if (avviato) process.exit(code ?? 0)
  })
}

prova(INTERPRETI)
