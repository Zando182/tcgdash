#!/usr/bin/env node
/**
 * Server statico per la cartella dist/, senza dipendenze.
 *
 * Serve per usare la dashboard su un PC qualunque: aprendo index.html da
 * file:// il browser puo' rifiutare localStorage e i match inseriti non si
 * salvano. Un server locale da' un'origine vera, quindi il salvataggio funziona.
 *
 *   node scripts/serve.mjs [porta]
 */
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { creaApiExcel } from './api.mjs'

const PROGETTO = resolve(import.meta.dirname, '..')
const ROOT = resolve(PROGETTO, 'dist')
const PORTA = Number(process.argv[2]) || 5190

// L'API che usa il workbook Excel come database dei match.
const apiExcel = creaApiExcel({ root: PROGETTO })

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

if (!existsSync(ROOT)) {
  console.error('Cartella dist/ assente. Lancia prima "npm run build".')
  process.exit(1)
}

const server = createServer(async (req, res) => {
  // Prima l'API: se la richiesta e' sua, il file statico non c'entra.
  if (await apiExcel(req, res)) return

  const url = decodeURIComponent((req.url ?? '/').split('?')[0])
  // normalize + prefisso: impedisce di uscire da dist/ con ../
  const richiesto = normalize(join(ROOT, url === '/' ? 'index.html' : url))
  const file = richiesto.startsWith(ROOT) && existsSync(richiesto) && statSync(richiesto).isFile()
    ? richiesto
    : join(ROOT, 'index.html')

  res.writeHead(200, {
    'Content-Type': TIPI[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  })
  createReadStream(file).pipe(res)
})

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Porta ${PORTA} occupata. Riprova con: node scripts/serve.mjs ${PORTA + 1}`)
    process.exit(1)
  }
  throw e
})

server.listen(PORTA, '127.0.0.1', () => {
  const indirizzo = `http://localhost:${PORTA}`
  console.log(`TCGDash su ${indirizzo}  (Ctrl+C per chiudere)`)
  console.log('I match inseriti vengono scritti su data/TCG_Match.xlsx.')
  // Apre il browser di sistema, su Windows, macOS e Linux.
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', indirizzo]]
      : process.platform === 'darwin'
        ? ['open', [indirizzo]]
        : ['xdg-open', [indirizzo]]
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
})
