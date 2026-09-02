/**
 * API locale che espone il workbook Excel come database della dashboard.
 *
 * Il browser non puo' scrivere su disco, quindi il salvataggio passa da qui:
 * la pagina chiama questi endpoint, il server lancia `scripts/excel_db.py` e
 * gli gira il registro. Lo stesso handler viene montato sia dal server di
 * `npm start` (scripts/serve.mjs) sia dal server di sviluppo (vite.config.ts),
 * cosi' `npm run dev` e `npm start` si comportano allo stesso modo.
 *
 * Quando il server non c'e' (la dashboard aperta da GitHub Pages, o senza
 * Python) queste rotte semplicemente non rispondono e la dashboard resta in
 * modalita' browser, salvando in localStorage.
 */
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const INTERPRETI = ['python3', 'python', 'py']
const CORPO_MASSIMO = 8 * 1024 * 1024

export function creaApiExcel({ root }) {
  const script = resolve(root, 'scripts', 'excel_db.py')
  // Il primo interprete che parte davvero viene ricordato: cercarlo a ogni
  // richiesta costerebbe due processi falliti per volta.
  let interprete = null

  const lancia = (cmd, args, stdin) =>
    new Promise((ok, ko) => {
      const proc = spawn(cmd, args, { cwd: root })
      let out = ''
      let err = ''
      let avviato = true
      proc.stdout.on('data', (d) => (out += String(d)))
      proc.stderr.on('data', (d) => (err += String(d)))
      proc.on('error', () => {
        avviato = false
        ko(Object.assign(new Error(`${cmd} non disponibile`), { assente: true }))
      })
      proc.on('close', (code) => {
        if (!avviato) return
        ok({ code, out, err })
      })
      if (stdin !== undefined) {
        proc.stdin.on('error', () => {
          // Se lo script muore prima di leggere lo stdin, l'EPIPE non deve
          // buttare giu' il server: l'esito arriva comunque da "close".
        })
        proc.stdin.end(stdin)
      }
    })

  /** Esegue un comando di excel_db.py e restituisce { stato, corpo }. */
  async function esegui(comando, stdin) {
    const candidati = interprete ? [interprete] : INTERPRETI
    let ultimo = null

    for (const cmd of candidati) {
      try {
        const { code, out, err } = await lancia(cmd, [script, comando], stdin)
        interprete = cmd
        let corpo
        try {
          corpo = JSON.parse(out)
        } catch {
          return {
            stato: 500,
            corpo: {
              errore: `Risposta non leggibile da ${comando}.`,
              dettaglio: (err || out).trim().split('\n').slice(-3).join('\n'),
            },
          }
        }
        return { stato: code === 0 ? 200 : 409, corpo }
      } catch (e) {
        ultimo = e
        if (!e.assente) throw e
      }
    }

    return {
      stato: 503,
      corpo: {
        errore:
          'Python non trovato: la dashboard resta in modalita' +
          " browser. Installa Python 3 e `pip install openpyxl` per scrivere sull'Excel.",
        motivo: 'python-mancante',
        dettaglio: ultimo?.message,
      },
    }
  }

  const leggiCorpo = (req) =>
    new Promise((ok, ko) => {
      let dati = ''
      req.on('data', (c) => {
        dati += c
        if (dati.length > CORPO_MASSIMO) {
          ko(new Error('Richiesta troppo grande.'))
          req.destroy()
        }
      })
      req.on('end', () => ok(dati))
      req.on('error', ko)
    })

  const rispondi = (res, stato, corpo) => {
    const testo = JSON.stringify(corpo)
    res.writeHead(stato, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end(testo)
  }

  /**
   * Gestisce la richiesta se e' una rotta dell'API. Restituisce true se l'ha
   * gestita, false per lasciarla al server statico.
   */
  return async function gestisci(req, res) {
    const url = (req.url ?? '/').split('?')[0]
    if (!url.startsWith('/api/excel/')) return false

    try {
      if (url === '/api/excel/stato' && req.method === 'GET') {
        const { stato, corpo } = await esegui('stato')
        rispondi(res, stato === 409 ? 200 : stato, corpo)
        return true
      }

      if (url === '/api/excel/registro' && req.method === 'GET') {
        const { stato, corpo } = await esegui('leggi')
        rispondi(res, stato, corpo)
        return true
      }

      if (url === '/api/excel/registro' && req.method === 'PUT') {
        const corpoRichiesta = await leggiCorpo(req)
        const { stato, corpo } = await esegui('scrivi', corpoRichiesta)
        rispondi(res, stato, corpo)
        return true
      }

      rispondi(res, 404, { errore: `Rotta sconosciuta: ${req.method} ${url}` })
      return true
    } catch (e) {
      rispondi(res, 500, { errore: e instanceof Error ? e.message : String(e) })
      return true
    }
  }
}
