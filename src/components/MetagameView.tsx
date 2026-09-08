import { useEffect, useMemo, useState } from 'react'
import { dataIt, pct } from '../lib/format'
import {
  aggiornaMetagame,
  datiMetagame,
  espansioni,
  matchupDi,
  partiteSenzaLista,
  riepilogoArchetipi,
  statoMetagame,
  torneiFiltrati,
  type DatiMetagame,
  type EsitoAggiornamento,
  type FiltriMeta,
  type StatoMetagame,
} from '../lib/metagame'
import { FILTRI_META_VUOTI } from '../lib/metagame'
import { Section, Stat, Vuoto, Winrate } from './ui'

const VUOTI: DatiMetagame = { aggiornato: '', archetipi: [], tornei: [], partite: [] }

/**
 * Il metagame dei tornei online Limitless: quali archetipi si giocano, come
 * vanno, e come va ognuno contro gli altri.
 *
 * A differenza del resto della dashboard questi non sono i tuoi match: sono
 * partite di altri, scaricate dall'API pubblica di Limitless e tenute in copia
 * locale. Le percentuali le calcola la dashboard dai risultati grezzi.
 */
export function MetagameView() {
  const [dati, setDati] = useState<DatiMetagame>(VUOTI)
  const [stato, setStato] = useState<StatoMetagame | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [scaricando, setScaricando] = useState(false)
  const [esito, setEsito] = useState<EsitoAggiornamento | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  const [filtri, setFiltri] = useState<FiltriMeta>(FILTRI_META_VUOTI)
  const [minimoPartite, setMinimoPartite] = useState(5)
  const [scelto, setScelto] = useState<number | null>(null)
  const [cerca, setCerca] = useState('')

  const carica = async () => {
    setCaricamento(true)
    const [s, d] = await Promise.all([statoMetagame(), datiMetagame()])
    setStato(s)
    setDati(d)
    setCaricamento(false)
  }

  useEffect(() => {
    void carica()
  }, [])

  const scarica = async () => {
    setScaricando(true)
    setErrore(null)
    try {
      const e = await aggiornaMetagame()
      setEsito(e)
      await carica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    } finally {
      setScaricando(false)
    }
  }

  const dentro = useMemo(() => torneiFiltrati(dati, filtri), [dati, filtri])
  const archetipi = useMemo(() => riepilogoArchetipi(dati, dentro), [dati, dentro])
  const matchup = useMemo(
    () => (scelto === null ? [] : matchupDi(dati, dentro, scelto, minimoPartite)),
    [dati, dentro, scelto, minimoPartite],
  )

  const uscite = useMemo(() => espansioni(dati), [dati])
  const partiteFiltrate = useMemo(
    () => dati.partite.reduce((n, p) => (dentro.has(p[0]) ? n + 1 : n), 0),
    [dati, dentro],
  )
  const senzaLista = useMemo(() => partiteSenzaLista(dati, dentro), [dati, dentro])

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    const soglia = Math.max(1, minimoPartite)
    const filtrati = archetipi.filter((a) => a.partite >= soglia)
    return q ? filtrati.filter((a) => a.nome.toLowerCase().includes(q)) : filtrati
  }, [archetipi, cerca, minimoPartite])

  const nomeScelto = scelto === null ? null : dati.archetipi[scelto]

  // Nessun server locale: la sezione non ha da dove prendere i dati.
  if (!caricamento && stato === null) {
    return (
      <Section title="Metagame">
        <div className="space-y-3 p-6 text-sm">
          <p className="text-ink-100">
            Questa sezione ha bisogno del server locale, che scarica i dati dei tornei.
          </p>
          <p className="text-ink-400">
            Aperta da GitHub Pages, o senza Python, non puo' funzionare: il sito non puo'
            interrogare Limitless al posto tuo ne' salvare la copia sul disco. Avviala in locale
            con <code className="text-ink-100">npm start</code>.
          </p>
        </div>
      </Section>
    )
  }

  const mai = !caricamento && dati.tornei.length === 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat
          label="Tornei scaricati"
          value={caricamento ? '…' : dentro.size}
          sub={dentro.size !== dati.tornei.length ? `di ${dati.tornei.length} in copia` : 'da Limitless'}
        />
        <Stat
          label="Partite"
          value={caricamento ? '…' : (partiteFiltrate - senzaLista).toLocaleString('it-IT')}
          sub={
            senzaLista > 0
              ? `${senzaLista} escluse: mazzo non registrato`
              : 'tutte con entrambi i mazzi noti'
          }
          tone={senzaLista > partiteFiltrate / 4 ? 'warn' : 'default'}
        />
        <Stat
          label="Archetipi"
          value={caricamento ? '…' : visibili.length}
          sub={`con almeno ${Math.max(1, minimoPartite)} partite`}
        />
        <Stat
          label="Ultimo aggiornamento"
          value={stato?.aggiornato ? new Date(stato.aggiornato).toLocaleDateString('it-IT') : '—'}
          sub={stato?.dal ? `tornei dal ${dataIt(stato.dal)} al ${dataIt(stato.al)}` : undefined}
        />
      </div>

      <Section
        title="Dati"
        hint="Solo tornei Standard della piattaforma Limitless, scaricati dalla loro API pubblica e tenuti in copia locale: la sezione resta consultabile anche senza rete."
        right={
          <button type="button" className="btn-primary text-xs" disabled={scaricando} onClick={() => void scarica()}>
            {scaricando ? 'Scarico…' : mai ? 'Scarica i tornei' : 'Scarica i nuovi tornei'}
          </button>
        }
      >
        <div className="space-y-2 p-3 text-sm">
          {errore && (
            <div className="rounded-lg border border-loss/40 bg-loss/10 px-2.5 py-2 text-[13px] text-rose-100">
              {errore}
            </div>
          )}
          {esito && !errore && (
            <p className="text-ink-300">
              Scaricati {esito.scaricati} tornei.
              {esito.scartati > 0 && ` Tolti ${esito.scartati} tornei GLC.`}
              {esito.completati > 0 && ` Classificati ${esito.completati} gia' in copia.`}{' '}
              {esito.restano > 0 && (
                <>
                  Ne restano <strong>{esito.restano}</strong>
                  {esito.fermatoDalLimite
                    ? ': Limitless concede 50 richieste ogni 5 minuti e il credito è finito. Riprova fra qualche minuto.'
                    : '. Premi di nuovo per continuare.'}
                </>
              )}
            </p>
          )}
          {mai && !esito && (
            <p className="text-ink-300">
              Non c'è ancora niente in copia. Premi <strong>Scarica i tornei</strong>: ci vuole
              circa un minuto, e si ferma da solo prima di esaurire il credito verso Limitless.
            </p>
          )}
          {uscite.length === 0 && dati.tornei.length > 0 && (
            <p className="text-[13px] text-ink-400">
              Tutti i tornei in copia stanno nella stessa espansione: la finestra scaricata e'
              troppo stretta perche' si veda un'uscita. Scaricandone altri il filtro Espansione si
              popola da solo.
            </p>
          )}
          {stato && (stato.online > 0 || stato.dalVivo > 0) && (
            <p className="text-[13px] text-ink-400">
              In copia: {stato.online} {stato.online === 1 ? 'torneo' : 'tornei'} online e{' '}
              {stato.dalVivo} dal vivo.
              {stato.senzaDettagli > 0 && ` ${stato.senzaDettagli} ancora da classificare.`}
            </p>
          )}
        </div>
      </Section>

      {!mai && (
        <>
          <div className="card flex flex-wrap items-end gap-x-4 gap-y-2 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] tracking-wide text-ink-400 uppercase">Dove</span>
              {(
                [
                  ['tutti', 'Tutti'],
                  ['online', 'Online'],
                  ['dalvivo', 'Dal vivo'],
                ] as const
              ).map(([valore, etichetta]) => {
                const quanti =
                  valore === 'tutti'
                    ? dati.tornei.length
                    : dati.tornei.filter((t) => t.online === (valore === 'online')).length
                return (
                  <button
                    key={valore}
                    type="button"
                    className={filtri.dove === valore ? 'chip-on' : 'chip'}
                    onClick={() => setFiltri((f) => ({ ...f, dove: valore }))}
                  >
                    {etichetta}
                    <span className="text-ink-500">{quanti}</span>
                  </button>
                )
              })}
            </div>

            <label
              className="flex items-center gap-1.5"
              title={
                uscite.length === 0
                  ? 'Nei dati scaricati non si vede nessuna uscita: sono tutti nello stesso pool di carte.'
                  : "L'ultima uscita gia' presente quando si e' giocato il torneo"
              }
            >
              <span className="text-[11px] tracking-wide text-ink-400 uppercase">Espansione</span>
              <select
                className="field py-1 text-xs"
                value={filtri.espansione}
                disabled={uscite.length === 0}
                onChange={(e) => setFiltri((f) => ({ ...f, espansione: e.target.value }))}
              >
                <option value="">{uscite.length === 0 ? 'una sola' : 'tutte'}</option>
                {uscite.map((u) => (
                  <option key={u.codice} value={u.codice}>
                    da {u.codice} ({u.tornei})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5">
              <span className="text-[11px] tracking-wide text-ink-400 uppercase">Dal</span>
              <input
                type="date"
                className="field py-1 text-xs"
                value={filtri.dal}
                onChange={(e) => setFiltri((f) => ({ ...f, dal: e.target.value }))}
              />
              <span className="text-[11px] tracking-wide text-ink-400 uppercase">al</span>
              <input
                type="date"
                className="field py-1 text-xs"
                value={filtri.al}
                onChange={(e) => setFiltri((f) => ({ ...f, al: e.target.value }))}
              />
            </label>

            <label className="flex items-center gap-1.5" title="Esclude i tornei piccoli">
              <span className="text-[11px] tracking-wide text-ink-400 uppercase">Torneo da almeno</span>
              <input
                type="number"
                min={0}
                step={8}
                className="field w-20 py-1 text-xs"
                value={filtri.giocatoriMinimi}
                onChange={(e) =>
                  setFiltri((f) => ({ ...f, giocatoriMinimi: Math.max(0, Number(e.target.value) || 0) }))
                }
              />
              <span className="text-[11px] text-ink-400">giocatori</span>
            </label>

            <label className="flex items-center gap-1.5" title="Sotto questa soglia una percentuale è solo rumore">
              <span className="text-[11px] tracking-wide text-ink-400 uppercase">Min. partite</span>
              <input
                type="number"
                min={1}
                className="field w-16 py-1 text-xs"
                value={minimoPartite}
                onChange={(e) => setMinimoPartite(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>

            <button
              type="button"
              className="chip ml-auto"
              onClick={() => {
                setFiltri(FILTRI_META_VUOTI)
                setMinimoPartite(5)
                setCerca('')
              }}
            >
              Azzera filtri
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <Section
              title="Archetipi"
              hint="Clicca un archetipo per vedere come va contro tutti gli altri."
              right={
                <input
                  className="field w-40 py-1 text-xs"
                  placeholder="cerca…"
                  value={cerca}
                  onChange={(e) => setCerca(e.target.value)}
                />
              }
            >
              {visibili.length === 0 ? (
                <Vuoto testo="Nessun archetipo con questi filtri." />
              ) : (
                <div className="max-h-[32rem] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-ink-900 text-[11px] tracking-wide text-ink-400 uppercase">
                      <tr className="border-b border-ink-700/70">
                        <th className="px-3 py-2 text-left font-medium">Archetipo</th>
                        <th className="px-2 py-2 text-right font-medium">Share</th>
                        <th className="px-2 py-2 text-right font-medium">Partite</th>
                        <th className="px-3 py-2 text-right font-medium">WR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-700/40">
                      {visibili.map((a) => (
                        <tr
                          key={a.indice}
                          onClick={() => setScelto(a.indice)}
                          className={`cursor-pointer hover:bg-ink-850 ${
                            scelto === a.indice ? 'bg-sky-500/10' : ''
                          }`}
                        >
                          <td className="px-3 py-1.5 text-ink-100">{a.nome}</td>
                          <td className="px-2 py-1.5 text-right text-ink-300">{pct(a.share, 1)}</td>
                          <td className="px-2 py-1.5 text-right text-ink-400">{a.partite}</td>
                          <td className="px-3 py-1.5 text-right">
                            <Winrate wr={a.winrate} partite={a.partite} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section
              title={nomeScelto ? `${nomeScelto} — contro gli altri` : 'Matchup'}
              hint={
                nomeScelto
                  ? 'Dal matchup migliore al peggiore. Lo specchio è segnato: contro se stesso il winrate è 50% per definizione.'
                  : 'Scegli un archetipo nell’elenco a fianco.'
              }
              right={
                nomeScelto ? (
                  <button type="button" className="chip" onClick={() => setScelto(null)}>
                    Deseleziona
                  </button>
                ) : undefined
              }
            >
              {scelto === null ? (
                <Vuoto testo="Nessun archetipo scelto." />
              ) : matchup.length === 0 ? (
                <Vuoto testo={`Nessun incrocio con almeno ${minimoPartite} partite. Abbassa la soglia.`} />
              ) : (
                <div className="max-h-[32rem] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-ink-900 text-[11px] tracking-wide text-ink-400 uppercase">
                      <tr className="border-b border-ink-700/70">
                        <th className="px-3 py-2 text-left font-medium">Avversario</th>
                        <th className="px-2 py-2 text-right font-medium">V–S</th>
                        <th className="px-2 py-2 text-right font-medium">Partite</th>
                        <th className="px-3 py-2 text-right font-medium">WR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-700/40">
                      {matchup.map((m) => (
                        <tr key={m.indice} className={m.specchio ? 'opacity-50' : 'hover:bg-ink-850'}>
                          <td className="px-3 py-1.5 text-ink-100">
                            {m.nome}
                            {m.specchio && (
                              <span className="ml-1.5 text-[11px] text-ink-400">specchio</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap text-ink-400">
                            {m.vittorie}–{m.partite - m.vittorie - m.pareggi}
                            {m.pareggi > 0 && <span className="text-ink-600">–{m.pareggi}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right text-ink-400">{m.partite}</td>
                          <td className="px-3 py-1.5 text-right">
                            <Winrate wr={m.winrate} partite={m.partite} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  )
}
