import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
// @ts-expect-error - modulo .mjs senza tipi, condiviso col server di npm start
import { creaApiExcel } from './scripts/api.mjs'

const ROOT = import.meta.dirname
const DATA_DIR = resolve(ROOT, 'data')
const INGEST = resolve(ROOT, 'scripts', 'ingest_xlsx.py')

/**
 * Rigenera src/data/seed.json quando cambia il workbook in data/: basta
 * salvare l'Excel e il registro di partenza si aggiorna da solo (l'HMR
 * ricarica il JSON). Serve Python con openpyxl; se manca, si avvisa e basta.
 */
function autoIngest(): Plugin {
  let inCorso = false
  let daRifare = false

  const ingest = (file: string, log: (m: string) => void, warn: (m: string) => void) => {
    if (inCorso) {
      daRifare = true
      return
    }
    inCorso = true

    const prova = (candidati: string[]) => {
      const [cmd, ...resto] = candidati
      if (!cmd) {
        inCorso = false
        warn('seed: nessun interprete Python trovato. Lancia a mano "npm run ingest".')
        return
      }
      const proc = spawn(cmd, [INGEST, file], { cwd: ROOT })
      let stderr = ''
      // Un comando inesistente emette sia "error" sia "close": senza questo
      // flag ogni macchina senza "python" vedrebbe un falso errore di ingest.
      let avviato = true
      proc.stderr.on('data', (d) => (stderr += String(d)))
      proc.on('error', () => {
        avviato = false
        prova(resto)
      })
      proc.on('close', (code) => {
        if (!avviato) return
        inCorso = false
        if (code === 0) log(`seed rigenerato da ${file.split(/[\\/]/).pop()}`)
        else warn(`seed: ingest fallito (${code}). ${stderr.trim().split('\n').pop() ?? ''}`)
        if (daRifare) {
          daRifare = false
          ingest(file, log, warn)
        }
      })
    }

    prova(['python', 'python3', 'py'])
  }

  return {
    name: 'tcgdash-auto-ingest',
    apply: 'serve',
    configureServer(server) {
      if (!existsSync(INGEST)) return
      // Chokidar 4 non supporta i glob: si guarda la cartella.
      server.watcher.add(DATA_DIR)

      // Su Windows il watcher normalizza i separatori, resolve() no.
      const posix = (p: string) => p.split('\\').join('/')
      const dir = posix(DATA_DIR)

      const onChange = (file: string) => {
        const f = posix(file)
        if (!f.startsWith(`${dir}/`) || !f.toLowerCase().endsWith('.xlsx')) return
        // I file di lock di Excel (~$nome.xlsx) non sono workbook.
        if ((f.split('/').pop() ?? '').startsWith('~$')) return
        ingest(
          file,
          (m) => server.config.logger.info(`\x1b[36m[tcgdash]\x1b[0m ${m}`),
          (m) => server.config.logger.warn(`\x1b[33m[tcgdash]\x1b[0m ${m}`),
        )
      }

      server.watcher.on('add', onChange)
      server.watcher.on('change', onChange)
    },
  }
}

/**
 * Monta in sviluppo la stessa API del server di `npm start`, cosi' anche con
 * `npm run dev` i match finiscono nel workbook invece che solo nel browser.
 */
function apiExcel(): Plugin {
  return {
    name: 'tcgdash-api-excel',
    apply: 'serve',
    configureServer(server) {
      const gestisci = creaApiExcel({ root: ROOT })
      server.middlewares.use((req, res, next) => {
        gestisci(req, res).then((gestita: boolean) => {
          if (!gestita) next()
        }, next)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), autoIngest(), apiExcel()],
  // Percorsi relativi: dist/ funziona anche aperta da file://, quindi si copia
  // su qualunque PC e si apre index.html senza installare nulla.
  base: './',
  server: { port: 5190, open: true },
})
