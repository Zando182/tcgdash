import { useMemo, useState } from 'react'
import { pct } from '../lib/format'
import { cella, matrice, raggruppa } from '../lib/stats'
import { useFiltri } from '../store/useFiltri'
import type { Dimensione, Match } from '../types'
import { BarreWinrate } from './charts'
import { Section, Vuoto, Winrate, sfondoWinrate } from './ui'

const DIMENSIONI: { valore: Dimensione; etichetta: string }[] = [
  { valore: 'deck', etichetta: 'Mio mazzo' },
  { valore: 'decklist', etichetta: 'Mia lista' },
  { valore: 'avversario', etichetta: 'Mazzo avversario' },
  { valore: 'formato', etichetta: 'Espansione' },
  { valore: 'turno', etichetta: 'Turno' },
  { valore: 'torneo', etichetta: 'Torneo' },
  { valore: 'tag', etichetta: 'Tag' },
]

/**
 * La matrice matchup del workbook, resa navigabile: righe e colonne si
 * scelgono, la cella mostra winrate e partite, e un puntino segnala che su
 * quel matchup ci sono note scritte.
 */
export function MatchupView({ match }: { match: Match[] }) {
  const { soloQuesto } = useFiltri()
  const [dimRiga, setDimRiga] = useState<Dimensione>('avversario')
  const [dimColonna, setDimColonna] = useState<Dimensione>('decklist')
  const [minimo, setMinimo] = useState(1)

  const m = useMemo(() => matrice(match, dimRiga, dimColonna), [match, dimRiga, dimColonna])
  const righe = m.righe.filter((r) => (m.totaliRiga.get(r)?.partite ?? 0) >= minimo)

  const favorevoli = useMemo(
    () =>
      raggruppa(match, 'avversario')
        .filter((g) => g.partite >= 3)
        .sort((a, b) => (b.winrate ?? 0) - (a.winrate ?? 0)),
    [match],
  )

  if (match.length === 0) {
    return <Vuoto testo="Nessun match con questi filtri: allarga la selezione." />
  }

  return (
    <div className="space-y-3">
      <Section
        title="Matrice matchup"
        hint="Winrate mio in ogni incrocio. Il colore va dal rosso al verde e si accende con le partite giocate: le celle da una partita restano volutamente smorte. Il puntino ambra segnala note scritte su quel matchup."
        right={
          <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
            <label className="flex items-center gap-1">
              min. partite
              <input
                type="number"
                min={1}
                max={20}
                value={minimo}
                onChange={(e) => setMinimo(Math.max(1, Number(e.target.value) || 1))}
                className="field w-14 py-0.5 text-xs"
              />
            </label>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-700/70 px-3 py-2">
          <Selettore
            etichetta="Righe"
            valore={dimRiga}
            onChange={setDimRiga}
            escludi={dimColonna}
          />
          <Selettore
            etichetta="Colonne"
            valore={dimColonna}
            onChange={setDimColonna}
            escludi={dimRiga}
          />
        </div>

        {righe.length === 0 ? (
          <Vuoto testo="Nessuna riga raggiunge il minimo di partite impostato." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] tracking-wide text-ink-400 uppercase">
                <tr className="border-b border-ink-700/70">
                  <th className="sticky left-0 z-10 min-w-52 bg-ink-900 px-3 py-2 text-left font-medium">
                    {DIMENSIONI.find((d) => d.valore === dimRiga)?.etichetta} \{' '}
                    {DIMENSIONI.find((d) => d.valore === dimColonna)?.etichetta}
                  </th>
                  {m.colonne.map((c) => (
                    <th key={c} className="px-2 py-2 text-center font-medium">
                      <button
                        type="button"
                        className="max-w-24 truncate hover:text-ink-100"
                        title={`${c} — clicca per filtrare`}
                        onClick={() => dimColonnaFiltrabile(dimColonna) && soloQuesto(dimColonna, c)}
                      >
                        {c}
                      </button>
                      <div className="text-[9px] font-normal text-ink-600">
                        {m.totaliColonna.get(c)?.partite ?? 0}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/40">
                {righe.map((r) => {
                  const tot = m.totaliRiga.get(r)
                  return (
                    <tr key={r} className="hover:bg-ink-850/40">
                      <td className="sticky left-0 z-10 bg-ink-900 px-3 py-1 whitespace-nowrap">
                        <button
                          type="button"
                          className="text-left text-ink-100 hover:text-sky-300"
                          title="Clicca per filtrare su questa riga"
                          onClick={() => dimColonnaFiltrabile(dimRiga) && soloQuesto(dimRiga, r)}
                        >
                          {r}
                        </button>
                      </td>
                      {m.colonne.map((c) => {
                        const cel = cella(m, r, c)
                        return (
                          <td
                            key={c}
                            className="px-2 py-1 text-center"
                            style={{ background: sfondoWinrate(cel?.winrate ?? null, cel?.partite ?? 0) }}
                            title={
                              cel
                                ? `${r} vs ${c}: ${cel.vittorie}V/${cel.partite - cel.vittorie}S${cel.note ? ` · ${cel.note} note` : ''}`
                                : 'mai giocato'
                            }
                          >
                            {cel ? (
                              <span className="whitespace-nowrap">
                                <span className="font-semibold text-ink-100">{pct(cel.winrate, 0)}</span>
                                <span className="ml-1 text-[10px] text-ink-300/80">({cel.partite})</span>
                                {cel.note > 0 && <span className="ml-0.5 text-amber-300">•</span>}
                              </span>
                            ) : (
                              <span className="text-ink-700">·</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-1 text-right whitespace-nowrap">
                        <Winrate wr={tot?.winrate ?? null} partite={tot?.partite ?? 0} />
                        <span className="ml-1 text-[10px] text-ink-400">({tot?.partite ?? 0})</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section
          title="Matchup favorevoli"
          hint="Almeno 3 partite giocate, dal winrate piu' alto."
        >
          {favorevoli.length === 0 ? (
            <Vuoto testo="Serve almeno un avversario con 3 partite." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <BarreWinrate righe={favorevoli.slice(0, 12)} onClick={(k) => soloQuesto('avversario', k)} />
            </div>
          )}
        </Section>

        <Section title="Matchup da studiare" hint="Almeno 3 partite giocate, dal winrate piu' basso.">
          {favorevoli.length === 0 ? (
            <Vuoto testo="Serve almeno un avversario con 3 partite." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <BarreWinrate
                righe={[...favorevoli].reverse().slice(0, 12)}
                onClick={(k) => soloQuesto('avversario', k)}
              />
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

/** I filtri globali non hanno un campo "turno" testuale: quella dimensione non e' cliccabile. */
function dimColonnaFiltrabile(
  d: Dimensione,
): d is 'deck' | 'avversario' | 'formato' | 'decklist' | 'torneo' | 'tag' {
  return d !== 'turno'
}

function Selettore({
  etichetta,
  valore,
  onChange,
  escludi,
}: {
  etichetta: string
  valore: Dimensione
  onChange: (d: Dimensione) => void
  escludi: Dimensione
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[11px] tracking-wide text-ink-400 uppercase">{etichetta}</span>
      <select
        className="field py-1 text-xs"
        value={valore}
        onChange={(e) => onChange(e.target.value as Dimensione)}
      >
        {DIMENSIONI.filter((d) => d.valore !== escludi).map((d) => (
          <option key={d.valore} value={d.valore}>
            {d.etichetta}
          </option>
        ))}
      </select>
    </label>
  )
}
