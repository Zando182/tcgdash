import { useRef, useState } from 'react'
import { matchInCsv, nomeFile } from '../lib/esporta'
import { dataIt } from '../lib/format'
import { scarica } from '../lib/storage'
import { infoSeed, leggiRegistro, useRegistro } from '../store/useMatch'
import { Section, Stat } from './ui'

/**
 * Dove stanno i dati, backup e ripristino.
 *
 * Le due modalita' non sono equivalenti e la pagina lo dice chiaro: con il
 * server locale il workbook e' il database e ogni match ci finisce dentro;
 * senza, i match restano nel browser e l'unico modo di portarli via e'
 * l'export.
 */
export function DatiView() {
  const {
    match,
    decklist,
    tornei,
    extra,
    modo,
    excel,
    caricamento,
    erroreExcel,
    ultimoSalvataggio,
    soloNelBrowser,
    salvataggioAttivo,
    sostituisci,
    ripristinaSeed,
    ricaricaDaExcel,
    riprovaSalvataggio,
    recuperaSoloNelBrowser,
  } = useRegistro()

  const file = useRef<HTMLInputElement>(null)
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null)
  const [confermaReset, setConfermaReset] = useState(false)

  // Il backup deve contenere tutto: prima c'erano solo i match, e un import
  // successivo avrebbe cancellato liste e tornei.
  const esportaJson = () =>
    scarica(
      nomeFile('json'),
      JSON.stringify({ match, decklist, tornei, extra }, null, 1),
      'application/json',
    )

  const esportaCsv = () => scarica(nomeFile('csv'), matchInCsv(match), 'text/csv')

  const importa = async (f: File) => {
    try {
      const testo = await f.text()
      const registro = leggiRegistro(testo)
      // Un file che non ha la sezione liste o tornei (i backup fatti prima che
      // esistessero) non deve azzerarle: si tengono quelle che ci sono.
      const grezzo = JSON.parse(testo) as { decklist?: unknown; tornei?: unknown }
      sostituisci({
        ...registro,
        decklist: Array.isArray(grezzo.decklist) ? registro.decklist : decklist,
        tornei: Array.isArray(grezzo.tornei) ? registro.tornei : tornei,
      })
      setEsito({ ok: true, testo: `Importati ${registro.match.length} match da ${f.name}.` })
    } catch (e) {
      setEsito({ ok: false, testo: e instanceof Error ? e.message : 'File non leggibile.' })
    }
  }

  const date = match.map((m) => m.data).filter(Boolean).sort()
  const inExcel = modo === 'excel'

  return (
    <div className="space-y-3">
      {soloNelBrowser.length > 0 && (
        <div className="card border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <strong>
            {soloNelBrowser.length}{' '}
            {soloNelBrowser.length === 1 ? 'match era rimasto' : 'match erano rimasti'} solo nel
            browser
          </strong>{' '}
          e non {soloNelBrowser.length === 1 ? 'e’' : 'sono'} nel workbook. Succede se
          {' '}{soloNelBrowser.length === 1 ? 'l’hai' : 'li hai'} inseriti senza il server
          locale, o con l'Excel aperto.
          <ul className="mt-1.5 space-y-0.5 text-[13px] text-amber-100/80">
            {soloNelBrowser.slice(0, 5).map((m) => (
              <li key={m.id}>
                {dataIt(m.data)} · {m.deck} vs {m.avversario} — {m.risultato}
              </li>
            ))}
            {soloNelBrowser.length > 5 && <li>…e altri {soloNelBrowser.length - 5}.</li>}
          </ul>
          <button
            type="button"
            className="btn mt-2 text-xs"
            onClick={() => void recuperaSoloNelBrowser()}
          >
            Aggiungili al workbook
          </button>
        </div>
      )}

      {!salvataggioAttivo && (
        <div className="card border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Il browser sta bloccando il salvataggio locale (succede aprendo <code>index.html</code> da
          file:// o in finestra anonima). Avvia la dashboard con <code>npm start</code>.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat
          label="Dove finiscono i match"
          value={caricamento ? '…' : inExcel ? 'Excel' : 'Browser'}
          tone={inExcel ? 'good' : 'warn'}
          sub={inExcel ? excel?.file : 'solo in questo browser'}
        />
        <Stat label="Match nel registro" value={match.length} />
        <Stat
          label="Periodo coperto"
          value={date.length ? dataIt(date[0]) : '—'}
          sub={date.length ? `fino al ${dataIt(date[date.length - 1])}` : undefined}
        />
        <Stat label="Match annotati" value={match.filter((m) => m.note.trim()).length} />
      </div>

      <Section
        title="Il workbook come database"
        hint="Con il server locale attivo, ogni match inserito viene riscritto sul foglio Match del workbook. Il browser tiene comunque una copia, cosi' niente va perso se l'Excel e' aperto."
        right={
          <button
            type="button"
            className="btn text-xs"
            disabled={caricamento}
            onClick={() => void ricaricaDaExcel()}
          >
            {caricamento ? 'Leggo…' : 'Rileggi dal workbook'}
          </button>
        }
      >
        <div className="space-y-2 p-3 text-sm">
          {inExcel ? (
            <>
              <Riga etichetta="File" valore={<code className="text-ink-100">{excel?.file}</code>} />
              <Riga etichetta="Fogli nel workbook" valore={(excel?.fogli ?? []).join(', ') || '—'} />
              <Riga
                etichetta="Match nel foglio"
                valore={excel?.match != null ? String(excel.match) : '—'}
              />
              <Riga
                etichetta="Ultima scrittura"
                valore={
                  erroreExcel ? (
                    <span className="text-loss">fallita</span>
                  ) : ultimoSalvataggio ? (
                    new Date(ultimoSalvataggio).toLocaleTimeString('it-IT')
                  ) : (
                    'nessuna in questa sessione'
                  )
                }
              />
              <Riga
                etichetta="Excel aperto sul file"
                valore={
                  excel?.bloccato ? (
                    <span className="text-amber-400">si — chiudilo per poter scrivere</span>
                  ) : (
                    'no'
                  )
                }
              />
              {erroreExcel && (
                <div className="rounded-lg border border-loss/40 bg-loss/10 px-2.5 py-2 text-[13px] text-rose-100">
                  {erroreExcel}
                  <button
                    type="button"
                    className="btn ml-2 px-2 py-0.5 text-xs"
                    onClick={() => void riprovaSalvataggio()}
                  >
                    Riprova
                  </button>
                </div>
              )}
              <p className="pt-1 text-[13px] text-ink-400">
                Ogni scrittura fa prima una copia in <code>data/backup/</code> (le ultime 30). Il
                workbook e' versionato in git: <code>git diff</code> non lo mostra leggibile, ma
                ogni commit ne conserva una versione intera.
              </p>
            </>
          ) : (
            <>
              <p className="text-ink-300">
                I match stanno solo nel browser di questo PC. Per usare il workbook come database
                avvia la dashboard in locale:
              </p>
              <pre className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-xs text-ink-100">
                npm start
              </pre>
              {excel?.errore && (
                <p className="text-[13px] text-amber-300">
                  Il server ha risposto: {excel.errore}
                </p>
              )}
              <p className="text-[13px] text-ink-400">
                Serve Python 3 con <code>openpyxl</code> (<code>pip install openpyxl</code>).
                Aperta da GitHub Pages la modalita' Excel non esiste: il sito non puo' scrivere sul
                tuo disco.
              </p>
            </>
          )}
        </div>
      </Section>

      <Section
        title="Backup"
        hint="Il JSON e' il backup completo e si reimporta qui. Il CSV ha le stesse colonne del foglio Match, quindi si riapre in Excel."
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
          L'import <strong>sostituisce</strong> il registro attuale
          {inExcel && ' e riscrive il workbook'}: esporta prima, se hai partite che non sono nel
          file.
        </p>
      </Section>

      <Section
        title="Registro di partenza"
        hint="Il seed committato nel repository: serve al deploy e a chi apre la dashboard senza server."
      >
        <div className="space-y-2 p-3 text-sm text-ink-300">
          <p>
            Generato da <code className="text-ink-100">{infoSeed.file}</code> il{' '}
            {dataIt(infoSeed.il)} — {infoSeed.match} match.
          </p>
          <p className="text-[13px] text-ink-400">
            Per riallinearlo al workbook di oggi:{' '}
            <code className="text-ink-100">npm run ingest</code>.
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
                    setEsito({ ok: true, testo: 'Registro riportato al seed.' })
                  }}
                >
                  Confermi? {inExcel ? 'Riscrive anche il workbook' : 'Perdi le modifiche locali'}
                </button>
                <button type="button" className="btn" onClick={() => setConfermaReset(false)}>
                  Annulla
                </button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setConfermaReset(true)}>
                Ripristina il registro dal seed
              </button>
            )}
          </div>
        </div>
      </Section>
    </div>
  )
}

function Riga({ etichetta, valore }: { etichetta: string; valore: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
      <span className="text-ink-400">{etichetta}</span>
      <span className="text-ink-100">{valore}</span>
    </div>
  )
}
