import { useMemo, useState } from 'react'
import { dataIt, normalizza, perNome } from '../lib/format'
import { winrate } from '../lib/format'
import { useFiltri } from '../store/useFiltri'
import type { Match } from '../types'
import { Section, Stat, Vuoto, Winrate } from './ui'

type Voce = {
  chiave: string
  titolo: string
  sottotitolo: string
  partite: number
  vittorie: number
  note: { id: string; data: string; testo: string; risultato: 'W' | 'L'; extra: string }[]
}

type Raggruppamento = 'matchup' | 'avversario' | 'deck' | 'cronologia'

const RAGGRUPPAMENTI: { valore: Raggruppamento; etichetta: string }[] = [
  { valore: 'matchup', etichetta: 'Per matchup (mazzo vs avversario)' },
  { valore: 'avversario', etichetta: 'Per mazzo avversario' },
  { valore: 'deck', etichetta: 'Per mio mazzo' },
  { valore: 'cronologia', etichetta: 'In ordine di data' },
]

/**
 * Il playbook: tutte le note scritte nei match, raccolte per matchup.
 *
 * Nel workbook le note stavano sparse in una colonna del registro e in una
 * tabella per deck; qui sono la pagina principale, perche' sono la parte che
 * il winrate da solo non dice — cosa fare in quel matchup.
 */
export function NoteView({ match }: { match: Match[] }) {
  const { filtri, imposta, soloQuesto } = useFiltri()
  const [raggruppa, setRaggruppa] = useState<Raggruppamento>('matchup')
  const [chiuse, setChiuse] = useState<Set<string>>(new Set())

  const conNote = useMemo(() => match.filter((m) => m.note.trim()), [match])

  const voci = useMemo<Voce[]>(() => {
    if (raggruppa === 'cronologia') {
      return [
        {
          chiave: 'tutte',
          titolo: 'Tutte le note',
          sottotitolo: 'dalla piu' + '’' + ' recente',
          partite: conNote.length,
          vittorie: conNote.filter((m) => m.risultato === 'W').length,
          note: [...conNote]
            .sort((a, b) => (a.data < b.data ? 1 : -1))
            .map((m) => ({
              id: m.id,
              data: m.data,
              testo: m.note.trim(),
              risultato: m.risultato,
              extra: `${m.deck} vs ${m.avversario}`,
            })),
        },
      ]
    }

    const mappa = new Map<string, Voce>()
    for (const m of conNote) {
      const chiave =
        raggruppa === 'matchup'
          ? `${m.deck} ||| ${m.avversario}`
          : raggruppa === 'avversario'
            ? m.avversario
            : m.deck
      let v = mappa.get(chiave)
      if (!v) {
        v = {
          chiave,
          titolo: raggruppa === 'matchup' ? m.avversario : chiave,
          sottotitolo: raggruppa === 'matchup' ? `con ${m.deck}` : '',
          partite: 0,
          vittorie: 0,
          note: [],
        }
        mappa.set(chiave, v)
      }
      v.note.push({
        id: m.id,
        data: m.data,
        testo: m.note.trim(),
        risultato: m.risultato,
        extra:
          raggruppa === 'matchup'
            ? [m.decklist, m.turno ? `${m.turno}°` : ''].filter(Boolean).join(' · ')
            : raggruppa === 'avversario'
              ? m.deck
              : m.avversario,
      })
    }

    // Partite e winrate del gruppo si contano su TUTTI i match, non solo su
    // quelli annotati: la nota serve a spiegare un matchup, e il matchup vale
    // per tutte le partite giocate.
    for (const m of match) {
      const chiave =
        raggruppa === 'matchup'
          ? `${m.deck} ||| ${m.avversario}`
          : raggruppa === 'avversario'
            ? m.avversario
            : m.deck
      const v = mappa.get(chiave)
      if (!v) continue
      v.partite++
      if (m.risultato === 'W') v.vittorie++
    }

    for (const v of mappa.values()) v.note.sort((a, b) => (a.data < b.data ? 1 : -1))

    return [...mappa.values()].sort(
      (a, b) => b.note.length - a.note.length || perNome(a.titolo, b.titolo),
    )
  }, [conNote, match, raggruppa])

  const commuta = (chiave: string) =>
    setChiuse((s) => {
      const n = new Set(s)
      if (n.has(chiave)) n.delete(chiave)
      else n.add(chiave)
      return n
    })

  const totNote = conNote.length
  const coperturaAvversari = useMemo(() => {
    const conAlmenoUna = new Set(conNote.map((m) => m.avversario))
    const tutti = new Set(match.map((m) => m.avversario))
    return { annotati: conAlmenoUna.size, totali: tutti.size }
  }, [conNote, match])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Note scritte" value={totNote} sub={`su ${match.length} match filtrati`} />
        <Stat
          label="Avversari con note"
          value={`${coperturaAvversari.annotati}/${coperturaAvversari.totali}`}
          sub="mazzi avversari coperti da almeno una nota"
          tone={coperturaAvversari.annotati < coperturaAvversari.totali / 2 ? 'warn' : 'good'}
        />
        <Stat label="Gruppi" value={voci.length} sub={RAGGRUPPAMENTI.find((r) => r.valore === raggruppa)?.etichetta} />
        <Stat
          label="Winrate dei match annotati"
          value={
            <Winrate
              wr={winrate(conNote.filter((m) => m.risultato === 'W').length, conNote.length)}
              partite={conNote.length}
            />
          }
          sub="quanto vinci nelle partite che commenti"
        />
      </div>

      <Section
        title="Playbook"
        hint="Ogni nota che hai scritto nei match, raccolta per matchup. Cerca una carta o una linea per ritrovare subito cosa avevi imparato."
        right={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <input
              className="field w-56 py-1 text-xs"
              placeholder="cerca nelle note..."
              value={filtri.cerca}
              onChange={(e) => imposta('cerca', e.target.value)}
            />
            <select
              className="field py-1 text-xs"
              value={raggruppa}
              onChange={(e) => setRaggruppa(e.target.value as Raggruppamento)}
            >
              {RAGGRUPPAMENTI.map((r) => (
                <option key={r.valore} value={r.valore}>
                  {r.etichetta}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {voci.length === 0 ? (
          <Vuoto
            testo={
              match.length === 0
                ? 'Nessun match con questi filtri.'
                : 'Nessuna nota nei match filtrati. Scrivine una dalla pagina Inserisci: e’ la parte che il winrate non racconta.'
            }
          />
        ) : (
          <ul className="divide-y divide-ink-700/50">
            {voci.map((v) => {
              const chiusa = chiuse.has(v.chiave)
              return (
                <li key={v.chiave}>
                  <button
                    type="button"
                    onClick={() => commuta(v.chiave)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-850/60"
                  >
                    <span className="w-3 shrink-0 text-ink-400">{chiusa ? '▸' : '▾'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-100">{v.titolo}</span>
                      {v.sottotitolo && (
                        <span className="block text-[11px] text-ink-400">{v.sottotitolo}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-400">
                      {v.note.length} {v.note.length === 1 ? 'nota' : 'note'}
                    </span>
                    {v.partite > 0 && (
                      <span className="shrink-0 text-xs">
                        <Winrate wr={winrate(v.vittorie, v.partite)} partite={v.partite} />
                        <span className="ml-1 text-[11px] text-ink-400">
                          ({v.vittorie}/{v.partite})
                        </span>
                      </span>
                    )}
                  </button>

                  {!chiusa && (
                    <ul className="space-y-1.5 px-3 pb-3 pl-9">
                      {v.note.map((n) => (
                        <li
                          key={n.id}
                          className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-2"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">
                            <span
                              className={`rounded px-1 font-bold ${
                                n.risultato === 'W' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'
                              }`}
                            >
                              {n.risultato}
                            </span>
                            <span>{dataIt(n.data)}</span>
                            {n.extra && <span>· {n.extra}</span>}
                          </div>
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-amber-50/95">
                            <Evidenzia testo={n.testo} cerca={filtri.cerca} />
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section
        title="Matchup senza note"
        hint="Avversari che hai incontrato almeno due volte senza mai scrivere niente: sono i primi da annotare."
      >
        <ScopertiDaAnnotare match={match} onFiltra={(a) => soloQuesto('avversario', a)} />
      </Section>
    </div>
  )
}

/** Evidenzia il testo cercato dentro la nota, cosi' si trova a colpo d'occhio. */
function Evidenzia({ testo, cerca }: { testo: string; cerca: string }) {
  const q = cerca.trim()
  if (!q) return <>{testo}</>
  const indice = normalizza(testo).indexOf(normalizza(q))
  if (indice < 0) return <>{testo}</>
  return (
    <>
      {testo.slice(0, indice)}
      <mark className="rounded bg-sky-400/30 px-0.5 text-sky-50">{testo.slice(indice, indice + q.length)}</mark>
      {testo.slice(indice + q.length)}
    </>
  )
}

function ScopertiDaAnnotare({
  match,
  onFiltra,
}: {
  match: Match[]
  onFiltra: (avversario: string) => void
}) {
  const scoperti = useMemo(() => {
    const conta = new Map<string, { partite: number; vittorie: number; note: number }>()
    for (const m of match) {
      const v = conta.get(m.avversario) ?? { partite: 0, vittorie: 0, note: 0 }
      v.partite++
      if (m.risultato === 'W') v.vittorie++
      if (m.note.trim()) v.note++
      conta.set(m.avversario, v)
    }
    return [...conta.entries()]
      .filter(([, v]) => v.note === 0 && v.partite >= 2)
      .sort((a, b) => b[1].partite - a[1].partite || perNome(a[0], b[0]))
  }, [match])

  if (scoperti.length === 0) {
    return <Vuoto testo="Ogni avversario incontrato piu' di una volta ha almeno una nota. Ottimo." />
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-3">
      {scoperti.map(([nome, v]) => (
        <button
          key={nome}
          type="button"
          className="chip"
          title="Clicca per filtrare su questo avversario"
          onClick={() => onFiltra(nome)}
        >
          {nome}
          <span className="text-ink-500">
            {v.partite} match · <Winrate wr={winrate(v.vittorie, v.partite)} partite={v.partite} />
          </span>
        </button>
      ))}
    </div>
  )
}
