import { useMemo, useState } from 'react'
import { dataIt, normalizza, oggiIso } from '../lib/format'
import {
  ETICHETTA_ROUND,
  eAmichevole,
  esitiDi,
  esitoRound,
  recordPartite,
  recordRound,
  type EsitoRound,
} from '../lib/tornei'
import { liste, useRegistro, useTutteLePartite } from '../store/useMatch'
import {
  PIAZZAMENTI,
  TIPOLOGIE,
  type Esito,
  type PartitaTorneo,
  type Piazzamento,
  type TorneoMio,
  type Turno,
} from '../types'
import { CampoConElenco, Section, Vuoto } from './ui'

/** Una partita nel modulo: come una partita di torneo, ma l'esito puo' mancare. */
type BozzaPartita = { esito: Esito | null; turno: Turno | null; tag: string[]; note: string }
type BozzaRound = { avversario: string; g: [BozzaPartita, BozzaPartita, BozzaPartita] }

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

const PARTITA_VUOTA = (): BozzaPartita => ({ esito: null, turno: null, tag: [], note: '' })
const ROUND_VUOTO = (): BozzaRound => ({
  avversario: '',
  g: [PARTITA_VUOTA(), PARTITA_VUOTA(), PARTITA_VUOTA()],
})
const ROUND_INIZIALI = 3
const ROUND_MASSIMI = 20
const ID_TAG_NOTI = 'torneo-tag-noti'

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

/**
 * Quali partite del round si possono giocare: la prima sempre, la seconda
 * dopo la prima, la terza solo sull'1-1.
 */
function visibili(r: BozzaRound): [boolean, boolean, boolean] {
  const [a, b] = r.g
  return [true, a.esito !== null, a.esito !== null && b.esito !== null && a.esito !== b.esito]
}

/**
 * Una partita che non si puo' piu' giocare (si e' corretta una delle prime
 * due e l'1-1 e' saltato) perde l'esito: altrimenti un 2-0 con una terza
 * dimenticata diventerebbe un 2-1 mai giocato. Note, tag e 1°/2° invece
 * restano, come bozza: se la correzione era sbagliata e si torna all'1-1, non
 * si deve riscrivere tutto.
 */
function normalizzaRound(r: BozzaRound): BozzaRound {
  const g = [...r.g] as BozzaRound['g']
  for (let k = 0; k < 3; k++) {
    const v = visibili({ ...r, g })
    if (!v[k] && g[k].esito !== null) g[k] = { ...g[k], esito: null }
  }
  return { ...r, g }
}

/** Le partite giocate del round, cioe' quelle visibili con un esito. */
function giocate(r: BozzaRound): PartitaTorneo[] {
  const v = visibili(r)
  return r.g
    .filter((p, k) => v[k] && p.esito !== null)
    .map((p) => ({ esito: p.esito as Esito, turno: p.turno, tag: p.tag, note: p.note.trim() }))
}

/** Vero se nella partita si e' scritto qualcosa oltre all'esito. */
const haDettagli = (p: BozzaPartita) => p.turno !== null || p.tag.length > 0 || p.note.trim() !== ''

const COLORE_ESITO: Record<EsitoRound, string> = {
  V: 'bg-win/15 text-win border-win/40',
  P: 'bg-amber-400/15 text-amber-300 border-amber-400/40',
  S: 'bg-loss/15 text-loss border-loss/40',
}

/**
 * Inserimento di un torneo: dati generali, piazzamento (salvo in amichevole) e
 * un numero a scelta di round al meglio di tre, ognuno contro un mazzo.
 *
 * Ogni partita del round ha esito, chi ha iniziato, tag e note: nelle
 * statistiche diventa un match singolo come quelli inseriti a mano, con la
 * tipologia del torneo nella colonna Torneo. Il risultato del round non si
 * sceglie: si ricava dalle partite, cosi' non puo' contraddirle.
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
    const round = bozza.round.map((r) => ({ avversario: r.avversario, partite: giocate(r) }))
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
    for (const [i, r] of bozza.round.entries()) {
      const partite = giocate(r)
      // Con le partite ma senza avversario il round e' un dato a meta'.
      if (!r.avversario.trim() && partite.length > 0) {
        setMessaggio({ ok: false, testo: `Round ${i + 1}: manca il mazzo avversario.` })
        return
      }
      // Note o tag scritti in una partita senza esito andrebbero persi in
      // silenzio: meglio fermarsi e dirlo.
      const v = visibili(r)
      const k = r.g.findIndex((p, j) => v[j] && p.esito === null && haDettagli(p))
      if (k >= 0) {
        setMessaggio({
          ok: false,
          testo: `Round ${i + 1}, partita ${k + 1}: hai scritto dei dettagli ma manca l’esito (V o S).`,
        })
        return
      }
    }

    const round = bozza.round
      .filter((r) => r.avversario.trim() || giocate(r).length > 0)
      .map((r) => ({ avversario: r.avversario.trim(), partite: giocate(r) }))

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
    const nPartite = round.reduce((n, r) => n + r.partite.length, 0)
    setMessaggio({
      ok: true,
      testo: bozza.id
        ? 'Torneo aggiornato.'
        : `Torneo salvato: ${bozza.tipologia}, ${round.length} round, ${nPartite} partite.`,
    })
    setBozza(bozzaVuota({ formato: bozza.formato, deck: bozza.deck, decklist: bozza.decklist }))
  }

  const apriModifica = (t: TorneoMio) => {
    const round: BozzaRound[] = t.round.map((r) => {
      const g = [0, 1, 2].map((k) => {
        const p = r.partite[k]
        return p ? { esito: p.esito, turno: p.turno, tag: [...p.tag], note: p.note } : PARTITA_VUOTA()
      }) as BozzaRound['g']
      return { avversario: r.avversario, g }
    })
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

  const svuota = () => {
    setBozza(bozzaVuota(ultimo))
    setMessaggio(null)
  }

  return (
    <div className="space-y-3">
      <Section
        title={bozza.id ? 'Modifica torneo' : 'Nuovo torneo'}
        hint="Ogni round è al meglio di tre contro lo stesso mazzo. Ogni partita ha esito, chi ha iniziato, tag e note, e nelle statistiche conta come un match singolo."
        right={
          bozza.id ? (
            <button type="button" className="btn text-xs" onClick={svuota}>
              Annulla modifica
            </button>
          ) : undefined
        }
      >
        <form onSubmit={salva} className="space-y-4 p-3">
          <datalist id={ID_TAG_NOTI}>
            {elenchi.tag.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

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

            <ol className="space-y-2">
              {bozza.round.map((r, i) => (
                <RigaRound
                  key={i}
                  numero={i + 1}
                  round={r}
                  avversari={elenchi.avversario}
                  tagNoti={elenchi.tag}
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
            <button type="button" className="btn" onClick={svuota}>
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
        hint="Le partite dei tornei entrano nelle statistiche come match singoli: nel filtro Torneo le trovi sotto la loro tipologia."
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

                  {aperto && <DettaglioTorneo torneo={t} />}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}

function DettaglioTorneo({ torneo }: { torneo: TorneoMio }) {
  if (torneo.round.length === 0) {
    return <p className="px-3 pb-3 pl-9 text-[13px] text-ink-400">Nessun round registrato.</p>
  }
  return (
    <ol className="space-y-2 px-3 pb-3 pl-9">
      {torneo.round.map((r, i) => {
        const e = esitoRound(esitiDi(r))
        return (
          <li key={i} className="rounded-lg border border-ink-700/60 px-2.5 py-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>
                <span className="mr-2 text-[11px] text-ink-400">R{i + 1}</span>
                <span className="text-ink-100">{r.avversario || '—'}</span>
              </span>
              {e && (
                <span className={`rounded border px-1.5 text-[11px] font-semibold ${COLORE_ESITO[e]}`}>
                  {ETICHETTA_ROUND[e]}
                </span>
              )}
            </div>
            {r.partite.length > 0 && (
              <ul className="mt-1 space-y-1">
                {r.partite.map((p, k) => (
                  <li key={k} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                    <span className="w-6 text-ink-400">G{k + 1}</span>
                    <span className={`font-bold ${p.esito === 'W' ? 'text-win' : 'text-loss'}`}>
                      {p.esito === 'W' ? 'V' : 'S'}
                    </span>
                    <span className="text-ink-400">{p.turno ? `${p.turno}°` : '—'}</span>
                    {p.tag.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                    {p.note && (
                      <span className="basis-full border-l-2 border-amber-400/50 pl-2 text-[13px] leading-snug text-amber-100/90 sm:basis-auto">
                        {p.note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
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
  piccola = false,
  etichetta,
  tono,
}: {
  attiva: boolean
  onClick: () => void
  children: React.ReactNode
  piccola?: boolean
  etichetta?: string
  tono?: 'vinta' | 'persa'
}) {
  const acceso =
    tono === 'vinta'
      ? 'border-win/60 bg-win/20 font-bold text-win'
      : tono === 'persa'
        ? 'border-loss/60 bg-loss/20 font-bold text-loss'
        : 'border-sky-500/60 bg-sky-500/15 font-semibold text-sky-100'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attiva}
      aria-label={etichetta}
      className={`rounded-md border transition-colors ${piccola ? 'h-7 min-w-7 px-1.5 text-xs' : 'rounded-lg px-3 py-1.5 text-sm'} ${
        attiva ? acceso : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600'
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
  tagNoti,
  onCambia,
  onRimuovi,
}: {
  numero: number
  round: BozzaRound
  avversari: string[]
  tagNoti: string[]
  onCambia: (r: BozzaRound) => void
  onRimuovi?: () => void
}) {
  const esito = esitoRound(giocate(round).map((p) => p.esito))
  const vis = visibili(round)

  const cambiaPartita = (k: 0 | 1 | 2, p: BozzaPartita) => {
    const g = [...round.g] as BozzaRound['g']
    g[k] = p
    onCambia({ ...round, g })
  }

  return (
    <li className="rounded-lg border border-ink-700/70">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-700/50 px-2.5 py-2">
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
      </div>

      <div className="divide-y divide-ink-700/30">
        {([0, 1, 2] as const).map((k) =>
          vis[k] ? (
            <RigaPartita
              key={k}
              round={numero}
              numero={k + 1}
              partita={round.g[k]}
              tagNoti={tagNoti}
              onCambia={(p) => cambiaPartita(k, p)}
            />
          ) : null,
        )}
      </div>
    </li>
  )
}

function RigaPartita({
  round,
  numero,
  partita,
  tagNoti,
  onCambia,
}: {
  round: number
  numero: number
  partita: BozzaPartita
  tagNoti: string[]
  onCambia: (p: BozzaPartita) => void
}) {
  const imposta = <K extends keyof BozzaPartita>(k: K, v: BozzaPartita[K]) => onCambia({ ...partita, [k]: v })

  return (
    <div className="space-y-1.5 px-2.5 py-2 pl-12">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="w-6 text-[11px] font-semibold text-ink-400">G{numero}</span>
        <div className="flex gap-1">
          {(['W', 'L'] as const).map((v) => (
            <Scelta
              key={v}
              piccola
              attiva={partita.esito === v}
              tono={v === 'W' ? 'vinta' : 'persa'}
              etichetta={`Round ${round}, partita ${numero} ${v === 'W' ? 'vinta' : 'persa'}`}
              onClick={() => imposta('esito', partita.esito === v ? null : v)}
            >
              {v === 'W' ? 'V' : 'S'}
            </Scelta>
          ))}
        </div>
        <div className="flex gap-1">
          {([1, 2] as const).map((t) => (
            <Scelta
              key={t}
              piccola
              attiva={partita.turno === t}
              etichetta={`Round ${round}, partita ${numero}: ${t === 1 ? 'inizio io' : 'rispondo'}`}
              onClick={() => imposta('turno', partita.turno === t ? null : t)}
            >
              {t}°
            </Scelta>
          ))}
        </div>
        <CampoTag
          valori={partita.tag}
          tagNoti={tagNoti}
          etichetta={`Tag di round ${round}, partita ${numero}`}
          onCambia={(tag) => imposta('tag', tag)}
        />
      </div>
      <textarea
        className="field block min-h-8 w-full resize-y py-1 text-[13px] leading-snug"
        rows={1}
        placeholder={`Note di G${numero}: linee, carte chiave, errori…`}
        aria-label={`Note di round ${round}, partita ${numero}`}
        value={partita.note}
        onChange={(e) => imposta('note', e.target.value)}
      />
    </div>
  )
}

/**
 * Tag di una partita: quelli scelti come chip, e un campo che suggerisce
 * quelli gia' usati. Invio o virgola aggiungono; un tag scritto con le
 * maiuscole diverse da uno esistente diventa quello esistente, cosi' "bad
 * start" non nasce accanto a "Bad Start".
 */
function CampoTag({
  valori,
  tagNoti,
  etichetta,
  onCambia,
}: {
  valori: string[]
  tagNoti: string[]
  etichetta: string
  onCambia: (v: string[]) => void
}) {
  const [testo, setTesto] = useState('')

  const aggiungi = (grezzo: string) => {
    const nuovi = grezzo
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => tagNoti.find((n) => normalizza(n) === normalizza(t)) ?? t)
    const tutti = [...valori]
    for (const t of nuovi) if (!tutti.some((x) => normalizza(x) === normalizza(t))) tutti.push(t)
    if (tutti.length !== valori.length) onCambia(tutti)
    setTesto('')
  }

  return (
    <div className="flex min-w-48 flex-1 flex-wrap items-center gap-1">
      {valori.map((t) => (
        <span key={t} className="chip-on">
          {t}
          <button
            type="button"
            className="text-sky-300/70 hover:text-sky-100"
            aria-label={`Togli il tag ${t}`}
            onClick={() => onCambia(valori.filter((x) => x !== t))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="field min-w-28 flex-1 py-1 text-xs"
        list={ID_TAG_NOTI}
        placeholder={valori.length ? '+ tag' : 'Tag (Invio per aggiungere)'}
        aria-label={etichetta}
        value={testo}
        onChange={(e) => {
          const v = e.target.value
          if (v.includes(',')) aggiungi(v)
          else setTesto(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Invio qui aggiunge il tag, non deve salvare tutto il torneo.
            e.preventDefault()
            if (testo.trim()) aggiungi(testo)
          } else if (e.key === 'Backspace' && !testo && valori.length) {
            onCambia(valori.slice(0, -1))
          }
        }}
        onBlur={() => testo.trim() && aggiungi(testo)}
      />
    </div>
  )
}
