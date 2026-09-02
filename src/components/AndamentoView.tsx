import { useMemo, useState } from 'react'
import { dataBreve, delta, pct } from '../lib/format'
import {
  andamentoSettimanale,
  settimanaIso,
  settimaneComplete,
  type SerieSettimanale,
} from '../lib/stats'
import type { Dimensione, Match } from '../types'
import { GraficoAndamento, GraficoVolume, coloreSerie, type ModoLinea } from './charts'
import { Section, Vuoto, Winrate } from './ui'

const DIMENSIONI: { valore: Dimensione | 'nessuna'; etichetta: string }[] = [
  { valore: 'nessuna', etichetta: 'Complessivo' },
  { valore: 'deck', etichetta: 'Per mazzo' },
  { valore: 'avversario', etichetta: 'Per mazzo avversario' },
  { valore: 'formato', etichetta: 'Per espansione' },
  { valore: 'decklist', etichetta: 'Per lista' },
  { valore: 'turno', etichetta: 'Per turno (1° / 2°)' },
  { valore: 'torneo', etichetta: 'Per torneo' },
  { valore: 'tag', etichetta: 'Per tag' },
]

/**
 * Come cambia il winrate settimana per settimana, spezzato su una qualunque
 * delle dimensioni filtrabili.
 *
 * Con molti valori (i mazzi avversari sono decine) il grafico diventerebbe
 * illeggibile: si mostrano le serie con piu' partite, le altre restano
 * disponibili in legenda e nella tabella sotto.
 */
export function AndamentoView({ match }: { match: Match[] }) {
  const [dimensione, setDimensione] = useState<Dimensione | 'nessuna'>('deck')
  const [modo, setModo] = useState<ModoLinea>('settimanale')
  const [quante, setQuante] = useState(5)
  const [nascoste, setNascoste] = useState<Set<string>>(new Set())

  const settimane = useMemo(() => settimaneComplete(match), [match])
  const dim = dimensione === 'nessuna' ? null : dimensione
  const serie = useMemo(() => andamentoSettimanale(match, dim, settimane), [match, dim, settimane])
  const complessivo = useMemo(
    () => andamentoSettimanale(match, null, settimane),
    [match, settimane],
  )

  const mostrate = serie.slice(0, dim === null ? 1 : quante)

  const commuta = (chiave: string) =>
    setNascoste((s) => {
      const n = new Set(s)
      if (n.has(chiave)) n.delete(chiave)
      else n.add(chiave)
      return n
    })

  if (match.length === 0) {
    return <Vuoto testo="Nessun match con questi filtri: allarga la selezione." />
  }

  return (
    <div className="space-y-3">
      <Section
        title="Winrate per settimana"
        hint={
          modo === 'settimanale'
            ? 'Ogni punto e’ il winrate di quella settimana. Le settimane senza partite spezzano la linea.'
            : 'Winrate cumulato: la media da inizio periodo fino a quella settimana. Si muove meno, mostra la tendenza di fondo.'
        }
        right={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {(['settimanale', 'cumulato'] as ModoLinea[]).map((m) => (
              <button
                key={m}
                type="button"
                className={modo === m ? 'chip-on' : 'chip'}
                onClick={() => setModo(m)}
              >
                {m === 'settimanale' ? 'Settimana per settimana' : 'Cumulato'}
              </button>
            ))}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-700/70 px-3 py-2">
          <span className="text-[11px] tracking-wide text-ink-400 uppercase">Spezza per</span>
          {DIMENSIONI.map((d) => (
            <button
              key={d.valore}
              type="button"
              className={dimensione === d.valore ? 'chip-on' : 'chip'}
              onClick={() => {
                setDimensione(d.valore)
                setNascoste(new Set())
              }}
            >
              {d.etichetta}
            </button>
          ))}
          {dim !== null && serie.length > quante && (
            <button type="button" className="chip" onClick={() => setQuante((q) => q + 5)}>
              + mostra altre {Math.min(5, serie.length - quante)} serie
            </button>
          )}
          {dim !== null && quante > 5 && (
            <button type="button" className="chip" onClick={() => setQuante(5)}>
              torna a 5
            </button>
          )}
        </div>

        <GraficoAndamento
          serie={mostrate}
          settimane={settimane}
          modo={modo}
          nascoste={nascoste}
          onCommuta={commuta}
          altezza={300}
        />
      </Section>

      <Section
        title="Partite giocate per settimana"
        hint="Il volume dice quanto fidarsi del punto sopra: un 100% su due partite non e' un 100%."
      >
        {complessivo[0] && <GraficoVolume serie={complessivo[0]} settimane={settimane} altezza={110} />}
      </Section>

      <Section
        title={`Tabella settimanale${dim ? ` · ${DIMENSIONI.find((d) => d.valore === dim)?.etichetta.toLowerCase()}` : ''}`}
        hint="Gli stessi numeri del grafico, leggibili riga per riga. Fra parentesi vittorie/partite."
      >
        <TabellaSettimane serie={mostrate} settimane={settimane} tutte={serie} />
      </Section>
    </div>
  )
}

function TabellaSettimane({
  serie,
  settimane,
  tutte,
}: {
  serie: SerieSettimanale[]
  settimane: string[]
  tutte: SerieSettimanale[]
}) {
  if (serie.length === 0 || settimane.length === 0) {
    return <Vuoto testo="Nessun dato da mostrare." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[11px] tracking-wide text-ink-400 uppercase">
          <tr className="border-b border-ink-700/70">
            <th className="sticky left-0 z-10 bg-ink-900 px-3 py-2 text-left font-medium">Serie</th>
            {settimane.map((s) => (
              <th key={s} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                <div>{dataBreve(s)}</div>
                <div className="text-[9px] text-ink-600">S{settimanaIso(s)}</div>
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Totale</th>
            <th className="px-3 py-2 text-right font-medium" title="Differenza fra l'ultima e la prima settimana con partite">
              Δ
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700/40">
          {serie.map((s) => {
            const conPartite = s.punti.filter((p) => p.partite > 0)
            const primo = conPartite[0]
            const ultimo = conPartite[conPartite.length - 1]
            const variazione =
              conPartite.length >= 2 && primo.winrate !== null && ultimo.winrate !== null
                ? ultimo.winrate - primo.winrate
                : null

            return (
              <tr key={s.chiave} className="hover:bg-ink-850/60">
                <td className="sticky left-0 z-10 bg-ink-900 px-3 py-1.5 whitespace-nowrap">
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: coloreSerie(tutte.indexOf(s)) }}
                  />
                  <span className="text-ink-100">{s.chiave}</span>
                </td>
                {s.punti.map((p) => (
                  <td key={p.settimana} className="px-2 py-1.5 text-center whitespace-nowrap">
                    {p.partite === 0 ? (
                      <span className="text-ink-600">·</span>
                    ) : (
                      <>
                        <Winrate wr={p.winrate} partite={p.partite} />
                        <span className="ml-1 text-[10px] text-ink-400">
                          ({p.vittorie}/{p.partite})
                        </span>
                      </>
                    )}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  <Winrate wr={s.totale.winrate} partite={s.totale.partite} />
                  <span className="ml-1 text-[10px] text-ink-400">
                    ({s.totale.vittorie}/{s.totale.partite})
                  </span>
                </td>
                <td
                  className={`px-3 py-1.5 text-right whitespace-nowrap ${
                    variazione === null ? 'text-ink-600' : variazione > 0 ? 'text-win' : variazione < 0 ? 'text-loss' : 'text-ink-400'
                  }`}
                >
                  {variazione === null ? '—' : delta(variazione)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-ink-700/70 text-[11px] text-ink-400">
            <td className="sticky left-0 z-10 bg-ink-900 px-3 py-1.5">Partite totali</td>
            {settimane.map((s, i) => {
              const tot = serie.reduce((n, x) => n + x.punti[i].partite, 0)
              return (
                <td key={s} className="px-2 py-1.5 text-center">
                  {tot || '·'}
                </td>
              )
            })}
            <td className="px-3 py-1.5 text-right">
              {serie.reduce((n, x) => n + x.totale.partite, 0)}
            </td>
            <td className="px-3 py-1.5 text-right">
              {pct(
                (() => {
                  const p = serie.reduce((n, x) => n + x.totale.partite, 0)
                  const v = serie.reduce((n, x) => n + x.totale.vittorie, 0)
                  return p ? v / p : null
                })(),
                0,
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
