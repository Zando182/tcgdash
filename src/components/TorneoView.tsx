import { useMemo, useState } from 'react'
import { dataIt, oggiIso } from '../lib/format'
import {
  ETICHETTA_ROUND,
  eAmichevole,
  esitoRound,
  recordPartite,
  recordRound,
  type EsitoRound,
} from '../lib/tornei'
import { liste, useRegistro, useTutteLePartite } from '../store/useMatch'
import { PIAZZAMENTI, TIPOLOGIE, type Esito, type Piazzamento, type TorneoMio } from '../types'
import { CampoConElenco, Section, Vuoto } from './ui'

/** Un round nel modulo: tre caselle, ognuna vuota, vinta o persa. */
type BozzaRound = { avversario: string; g: [Esito | null, Esito | null, Esito | null] }

type Bozza = {
  id?: string
  data: string
  formato: string
  deck: string
  decklist: string
  tipologia: string
  piazzamento: Piazzamento | ''
  round: BozzaRound[]
}

const ROUND_VUOTO = (): BozzaRound => ({ avversario: '', g: [null, null, null] })
const ROUND_INIZIALI = 3
const ROUND_MASSIMI = 20

function bozzaVuota(base?: { formato: string; deck: string; decklist: string }): Bozza {
  return {
    data: oggiIso(),
    formato: base?.formato ?? '',
    deck: base?.deck ?? '',
    decklist: base?.decklist ?? '',
    tipologia: 'Local',
    piazzamento: '',
    round: Array.from({ length: ROUND_INIZIALI }, ROUND_VUOTO),
  }
}

/** Le partite di un round del modulo, senza le caselle vuote. */
const partiteDi = (r: BozzaRound): Esito[] => r.g.filter((x): x is Esito => x !== null)

/**
 * La terza partita si gioca solo sull'1-1. Quando le prime due non lo sono
 * piu' (si e' corretta una casella), la terza va svuotata: altrimenti un 2-0
 * con una terza partita dimenticata diventerebbe un 2-1 che non c'e' stato.
 */
function normalizzaRound(r: BozzaRound): BozzaRound {
  const [a, b, c] = r.g
  if (a === null) return { ...r, g: [null, null, null] }
  if (b === null) return { ...r, g: [a, null, null] }
  const unoUno = a !== b
  return { ...r, g: [a, b, unoUno ? c : null] }
}

const COLORE_ESITO: Record<EsitoRound, string> = {
  V: 'bg-win/15 text-win border-win/40',
  P: 'bg-amber-400/15 text-amber-300 border-amber-400/40',
  S: 'bg-loss/15 text-loss border-loss/40',
}

/**
 * Inserimento di un torneo: dati generali, piazzamento (salvo in amichevole) e
 * un numero a scelta di round al meglio di tre, ognuno contro un mazzo.
 *
 * Il risultato del round non si sceglie: si ricava dalle partite, cosi' non
 * puo' contraddirle. Le partite finiscono anche nelle statistiche della
 * dashboard, con la tipologia del torneo nella colonna Torneo.
 */
export function TorneoView() {
  const { tornei, extra, salvaTorneo, eliminaTorneo, match } = useRegistro()
  const tutte = useTutteLePartite()
  const elenchi = useMemo(() => liste(tutte, extra), [tutte, extra])

  // I campi che cambiano di rado si prendono dall'ultima cosa inserita,
  // torneo o partita singola che sia.
  const ultimo = useMemo(() => {
    const t = [...tornei].sort((a, b) => (a.data < b.data ? 1 : -1))[0]
    const m = match[0]
    if (t && (!m || t.data >= m.data)) return t
    return m
  }, [tornei, match])

  const [bozza, setBozza] = useState<Bozza>(() => bozzaVuota(ultimo))
  const [messaggio, setMessaggio] = useState<{ ok: boolean; testo: string } | null>(null)
  const [aperti, setAperti] = useState<Set<string>>(new Set())
  const [daEliminare, setDaEliminare] = useState<string | null>(null)

  const amichevole = eAmichevole(bozza.tipologia)
  const campo = <K extends keyof Bozza>(k: K, v: Bozza[K]) => setBozza((b) => ({ ...b, [k]: v }))

  const cambiaRound = (i: number, r: BozzaRound) =>
    setBozza((b) => ({ ...b, round: b.round.map((x, j) => (j === i ? normalizzaRound(r) : x)) }))

  const impostaNumeroRound = (n: number) =>
    setBozza((b) => {
      const quanti = Math.min(ROUND_MASSIMI, Math.max(1, n))
      const round = b.round.slice(0, quanti)
      while (round.length < quanti) round.push(ROUND_VUOTO())
      return { ...b, round }
    })

  const riepilogo = useMemo(() => {
    const round = bozza.round.map((r) => ({ avversario: r.avversario, partite: partiteDi(r) }))
    return { round: recordRound(round), partite: recordPartite(round) }
  }, [bozza.round])

  const salva = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bozza.deck.trim()) {
      setMessaggio({ ok: false, testo: 'Manca il mio mazzo.' })
      return
    }
    if (!amichevole && !bozza.piazzamento) {
      setMessaggio({ ok: false, testo: 'Manca il piazzamento: com’è andata?' })
      return
    }
    // Un round senza avversario e senza partite e' solo una riga lasciata
    // vuota; con le partite ma senza avversario invece e' un dato a meta'.
    const senzaAvversario = bozza.round.findIndex(
      (r) => !r.avversario.trim() && partiteDi(r).length > 0,
    )
    if (senzaAvversario >= 0) {
      setMessaggio({ ok: false, testo: `Round ${senzaAvversario + 1}: manca il mazzo avversario.` })
      return
    }

    const round = bozza.round
      .filter((r) => r.avversario.trim() || partiteDi(r).length > 0)
      .map((r) => ({ avversario: r.avversario.trim(), partite: partiteDi(r) }))

    salvaTorneo({
      id: bozza.id,
      data: bozza.data,
      formato: bozza.formato.trim(),
      deck: bozza.deck.trim(),
      decklist: bozza.decklist.trim(),
      tipologia: bozza.tipologia,
      piazzamento: amichevole ? null : (bozza.piazzamento as Piazzamento),
      round,
    })
    setMessaggio({
      ok: true,
      testo: bozza.id
        ? 'Torneo aggiornato.'
        : `Torneo salvato: ${bozza.tipologia}, ${round.length} round.`,
    })
    setBozza(bozzaVuota({ formato: bozza.formato, deck: bozza.deck, decklist: bozza.decklist }))
  }

  const apriModifica = (t: TorneoMio) => {
    const round: BozzaRound[] = t.round.map((r) => ({
      avversario: r.avversario,
      g: [r.partite[0] ?? null, r.partite[1] ?? null, r.partite[2] ?? null],
    }))
    setBozza({
      id: t.id,
      data: t.data,
      formato: t.formato,
      deck: t.deck,
      decklist: t.decklist,
      tipologia: t.tipologia,
      piazzamento: t.piazzamento ?? '',
      round: round.length ? round : [ROUND_VUOTO()],
    })
    setMessaggio(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ordinati = useMemo(
    () => [...tornei].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)),
    [tornei],
  )

  const commuta = (id: string) =>
    setAperti((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="space-y-3">
      <Section
        title={bozza.id ? 'Modifica torneo' : 'Nuovo torneo'}
        hint="Ogni round è al meglio di tre contro lo stesso mazzo. Il risultato del round si calcola da solo dalle partite."
        right={
          bozza.id ? (
            <button
              type="button"
              className="btn text-xs"
              onClick={() => {
                setBozza(bozzaVuota(ultimo))
                setMessaggio(null)
              }}
            >
              Annulla modifica
            </button>
          ) : undefined
        }
      >
        <form onSubmit={salva} className="space-y-4 p-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Campo etichetta="Data">
              <input
                type="date"
                className="field w-full"
                value={bozza.data}
                required
                onChange={(e) => campo('data', e.target.value)}
              />
            </Campo>
            <Campo etichetta="Espansione / formato">
              <CampoConElenco
                id="t-formato"
                valore={bozza.formato}
                onChange={(v) => campo('formato', v)}
                opzioni={elenchi.formato}
                placeholder="es. TEF-PBL"
              />
            </Campo>
            <Campo etichetta="Il mio mazzo *">
              <CampoConElenco
                id="t-deck"
                valore={bozza.deck}
                onChange={(v) => campo('deck', v)}
                opzioni={elenchi.deck}
                required
                placeholder="es. Dragapult ex Blaziken ex"
              />
            </Campo>
            <Campo etichetta="Lista usata">
              <CampoConElenco
                id="t-decklist"
                valore={bozza.decklist}
                onChange={(v) => campo('decklist', v)}
                opzioni={elenchi.decklist}
                placeholder="es. Dragapolli v3"
              />
            </Campo>
          </div>

          <Campo etichetta="Tipologia">
            <div className="flex flex-wrap gap-1.5">
              {TIPOLOGIE.map((t) => (
                <Scelta
                  key={t}
                  attiva={bozza.tipologia === t}
                  onClick={() =>
                    setBozza((b) => ({
                      ...b,
                      tipologia: t,
                      // In amichevole non ci si piazza: il campo si svuota.
                      piazzamento: eAmichevole(t) ? '' : b.piazzamento,
                    }))
                  }
                >
                  {t}
                </Scelta>
              ))}
            </div>
          </Campo>

          {!amichevole && (
            <Campo etichetta="Come ti sei piazzato? *">
              <div className="flex flex-wrap gap-1.5">
                {PIAZZAMENTI.map((p) => (
                  <Scelta
                    key={p}
                    attiva={bozza.piazzamento === p}
                    onClick={() => campo('piazzamento', bozza.piazzamento === p ? '' : p)}
                  >
                    {p}
                  </Scelta>
                ))}
              </div>
            </Campo>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Round</span>
              <input
                type="number"
                min={1}
                max={ROUND_MASSIMI}
                className="field w-16 py-1 text-sm"
                value={bozza.round.length}
                onChange={(e) => impostaNumeroRound(Number(e.target.value) || 1)}
                aria-label="Numero di round"
              />
              <button
                type="button"
                className="chip"
                disabled={bozza.round.length >= ROUND_MASSIMI}
                onClick={() => impostaNumeroRound(bozza.round.length + 1)}
              >
                + aggiungi round
              </button>
              <span className="text-[12px] text-ink-400">
                Round {riepilogo.round.v}V · {riepilogo.round.p}P · {riepilogo.round.s}S — partite{' '}
                {riepilogo.partite.v}–{riepilogo.partite.s}
              </span>
            </div>

            <ol className="divide-y divide-ink-700/40 rounded-lg border border-ink-700/70">
              {bozza.round.map((r, i) => (
                <RigaRound
                  key={i}
                  numero={i + 1}
                  round={r}
                  avversari={elenchi.avversario}
                  onCambia={(nuovo) => cambiaRound(i, nuovo)}
                  onRimuovi={
                    bozza.round.length > 1
                      ? () => setBozza((b) => ({ ...b, round: b.round.filter((_, j) => j !== i) }))
                      : undefined
                  }
                />
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary">
              {bozza.id ? 'Salva modifiche' : 'Salva torneo'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBozza(bozzaVuota(ultimo))
                setMessaggio(null)
              }}
            >
              Svuota
            </button>
            {messaggio && (
              <span className={`text-xs ${messaggio.ok ? 'text-ink-300' : 'text-loss'}`}>
                {messaggio.testo}
              </span>
            )}
          </div>
        </form>
      </Section>

      <Section
        title="I miei tornei"
        hint="Le partite dei tornei entrano anche nelle statistiche: nel filtro Torneo le trovi sotto la loro tipologia."
        right={<span className="text-[11px] text-ink-400">{tornei.length} tornei</span>}
      >
        {ordinati.length === 0 ? (
          <Vuoto testo="Nessun torneo salvato. Inseriscine uno qui sopra." />
        ) : (
          <ul className="divide-y divide-ink-700/50">
            {ordinati.map((t) => {
              const rr = recordRound(t.round)
              const rp = recordPartite(t.round)
              const aperto = aperti.has(t.id)
              return (
                <li key={t.id}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => commuta(t.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="w-3 shrink-0 text-ink-400">{aperto ? '▾' : '▸'}</span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="font-medium text-ink-100">{t.deck}</span>
                          <span className="chip">{t.tipologia}</span>
                          {t.piazzamento && (
                            <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 text-[11px] font-semibold text-sky-200">
                              {t.piazzamento}
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] text-ink-400">
                          {[
                            dataIt(t.data),
                            t.decklist,
                            t.formato,
                            `${t.round.length} round: ${rr.v}V ${rr.p}P ${rr.s}S`,
                            `partite ${rp.v}–${rp.s}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </button>
                    <span className="flex shrink-0 gap-1">
                      {daEliminare === t.id ? (
                        <>
                          <button
                            type="button"
                            className="rounded border border-loss/60 bg-loss/20 px-2 py-0.5 text-xs font-semibold text-loss"
                            onClick={() => {
                              eliminaTorneo(t.id)
                              setDaEliminare(null)
                            }}
                          >
                            Confermi?
                          </button>
                          <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => setDaEliminare(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => apriModifica(t)}>
                            Modifica
                          </button>
                          <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => setDaEliminare(t.id)}>
                            Elimina
                          </button>
                        </>
                      )}
                    </span>
                  </div>

                  {aperto && (
                    <div className="px-3 pb-3 pl-9">
                      {t.round.length === 0 ? (
                        <p className="text-[13px] text-ink-400">Nessun round registrato.</p>
                      ) : (
                        <table className="w-full max-w-xl text-sm">
                          <tbody className="divide-y divide-ink-700/40">
                            {t.round.map((r, i) => {
                              const e = esitoRound(r.partite)
                              return (
                                <tr key={i}>
                                  <td className="w-10 py-1 text-[11px] text-ink-400">R{i + 1}</td>
                                  <td className="py-1 text-ink-100">{r.avversario}</td>
                                  <td className="py-1 font-mono text-[12px] text-ink-300">
                                    {r.partite.map((p) => (p === 'W' ? 'V' : 'S')).join(' ')}
                                  </td>
                                  <td className="py-1 text-right">
                                    {e && (
                                      <span className={`rounded border px-1.5 text-[11px] font-semibold ${COLORE_ESITO[e]}`}>
                                        {ETICHETTA_ROUND[e]}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}

function Campo({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">{etichetta}</span>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Scelta({
  attiva,
  onClick,
  children,
}: {
  attiva: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attiva}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        attiva
          ? 'border-sky-500/60 bg-sky-500/15 font-semibold text-sky-100'
          : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600'
      }`}
    >
      {children}
    </button>
  )
}

function RigaRound({
  numero,
  round,
  avversari,
  onCambia,
  onRimuovi,
}: {
  numero: number
  round: BozzaRound
  avversari: string[]
  onCambia: (r: BozzaRound) => void
  onRimuovi?: () => void
}) {
  const partite = partiteDi(round)
  const esito = esitoRound(partite)
  const [a, b] = round.g
  // Si compila in ordine, e la terza si apre solo sull'1-1.
  const attiva = [true, a !== null, a !== null && b !== null && a !== b]

  const imposta = (k: 0 | 1 | 2, v: Esito) => {
    const g = [...round.g] as BozzaRound['g']
    g[k] = g[k] === v ? null : v
    onCambia({ ...round, g })
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2.5 py-2">
      <span className="w-8 text-[12px] font-semibold text-ink-400">R{numero}</span>
      <div className="min-w-48 flex-1">
        <CampoConElenco
          id={`t-avv-${numero}`}
          valore={round.avversario}
          onChange={(v) => onCambia({ ...round, avversario: v })}
          opzioni={avversari}
          placeholder="Mazzo avversario"
          className="py-1"
        />
      </div>
      <div className="flex items-center gap-2">
        {([0, 1, 2] as const).map((k) => (
          <div key={k} className={`flex items-center gap-0.5 ${attiva[k] ? '' : 'opacity-30'}`}>
            <span className="mr-0.5 text-[10px] text-ink-400">G{k + 1}</span>
            {(['W', 'L'] as const).map((v) => {
              const scelto = round.g[k] === v
              return (
                <button
                  key={v}
                  type="button"
                  disabled={!attiva[k]}
                  onClick={() => imposta(k, v)}
                  aria-pressed={scelto}
                  aria-label={`Partita ${k + 1} ${v === 'W' ? 'vinta' : 'persa'}`}
                  className={`h-7 w-7 rounded-md border text-xs font-bold transition-colors disabled:cursor-not-allowed ${
                    scelto
                      ? v === 'W'
                        ? 'border-win/60 bg-win/20 text-win'
                        : 'border-loss/60 bg-loss/20 text-loss'
                      : 'border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-600'
                  }`}
                >
                  {v === 'W' ? 'V' : 'S'}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <span className="w-20 text-right">
        {esito ? (
          <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${COLORE_ESITO[esito]}`}>
            {ETICHETTA_ROUND[esito]}
          </span>
        ) : (
          <span className="text-[11px] text-ink-600">—</span>
        )}
      </span>
      {onRimuovi && (
        <button
          type="button"
          onClick={onRimuovi}
          className="text-ink-600 hover:text-loss"
          aria-label={`Rimuovi round ${numero}`}
          title="Rimuovi questo round"
        >
          ×
        </button>
      )}
    </li>
  )
}
