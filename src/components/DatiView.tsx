import { useRef, useState } from 'react'
import { matchInCsv, nomeFile } from '../lib/esporta'
import { dataIt } from '../lib/format'
import { scarica } from '../lib/storage'
import { infoSeed, leggiRegistro, useRegistro } from '../store/useMatch'
import { Section, Stat } from './ui'

/**
 * Backup, ripristino e stato del registro.
 *
 * I dati vivono nel localStorage del browser: basta cambiare PC o svuotare la
 * cache per perderli, quindi l'export non e' un extra ma il modo normale di
 * portarseli dietro.
 */
export function DatiView() {
  const { match, extra, salvataggioAttivo, sostituisci, ripristinaSeed } = useRegistro()
  const file = useRef<HTMLInputElement>(null)
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null)
  const [confermaReset, setConfermaReset] = useState(false)

  const esportaJson = () =>
    scarica(nomeFile('json'), JSON.stringify({ match, extra }, null, 1), 'application/json')

  const esportaCsv = () => scarica(nomeFile('csv'), matchInCsv(match), 'text/csv')

  const importa = async (f: File) => {
    try {
      const registro = leggiRegistro(await f.text())
      sostituisci(registro)
      setEsito({ ok: true, testo: `Importati ${registro.match.length} match da ${f.name}.` })
    } catch (e) {
      setEsito({ ok: false, testo: e instanceof Error ? e.message : 'File non leggibile.' })
    }
  }

  const date = match.map((m) => m.data).filter(Boolean).sort()

  return (
    <div className="space-y-3">
      {!salvataggioAttivo && (
        <div className="card border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Il browser sta bloccando il salvataggio locale (succede aprendo <code>index.html</code> da
          file:// o in finestra anonima). I match inseriti spariranno alla ricarica: avvia la
          dashboard con <code>npm start</code> oppure esporta il JSON prima di chiudere.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Match nel registro" value={match.length} />
        <Stat
          label="Periodo coperto"
          value={date.length ? dataIt(date[0]) : '—'}
          sub={date.length ? `fino al ${dataIt(date[date.length - 1])}` : undefined}
        />
        <Stat label="Match annotati" value={match.filter((m) => m.note.trim()).length} />
        <Stat
          label="Salvataggio locale"
          value={salvataggioAttivo ? 'Attivo' : 'Bloccato'}
          tone={salvataggioAttivo ? 'good' : 'warn'}
          sub={salvataggioAttivo ? 'nel browser di questo PC' : 'esporta prima di chiudere'}
        />
      </div>

      <Section
        title="Backup"
        hint="Il JSON e' il backup completo e si reimporta qui. Il CSV ha le stesse colonne del foglio Match del workbook, quindi si riapre in Excel."
      >
        <div className="flex flex-wrap items-center gap-2 p-3">
          <button type="button" className="btn-primary" onClick={esportaJson}>
            Esporta JSON
          </button>
          <button type="button" className="btn" onClick={esportaCsv}>
            Esporta CSV (per Excel)
          </button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            Importa JSON…
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importa(f)
              e.target.value = ''
            }}
          />
          {esito && (
            <span className={`text-xs ${esito.ok ? 'text-win' : 'text-loss'}`}>{esito.testo}</span>
          )}
        </div>
        <p className="border-t border-ink-700/70 px-3 py-2 text-[11px] text-ink-400">
          L'import <strong>sostituisce</strong> il registro attuale: esporta prima, se hai partite
          che non sono nel file.
        </p>
      </Section>

      <Section
        title="Registro di partenza"
        hint="Il seed generato dall'Excel, committato nel repository: e' quello da cui riparte una dashboard nuova."
      >
        <div className="space-y-2 p-3 text-sm text-ink-300">
          <p>
            Generato da <code className="text-ink-100">{infoSeed.file}</code> il{' '}
            {dataIt(infoSeed.il)} — {infoSeed.match} match.
          </p>
          <p className="text-[13px] text-ink-400">
            Per rigenerarlo da un Excel aggiornato: copia il workbook in <code>data/</code> e lancia{' '}
            <code className="text-ink-100">npm run ingest</code> (con <code>npm run dev</code> attivo
            succede da solo appena salvi il file).
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {confermaReset ? (
              <>
                <button
                  type="button"
                  className="rounded-lg border border-loss/60 bg-loss/20 px-3 py-1.5 text-sm font-semibold text-loss"
                  onClick={() => {
                    ripristinaSeed()
                    setConfermaReset(false)
                    setEsito({ ok: true, testo: 'Registro riportato al seed dell’Excel.' })
                  }}
                >
                  Confermi? Perdi le modifiche locali
                </button>
                <button type="button" className="btn" onClick={() => setConfermaReset(false)}>
                  Annulla
                </button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setConfermaReset(true)}>
                Ripristina il registro dall'Excel
              </button>
            )}
          </div>
        </div>
      </Section>
    </div>
  )
}
