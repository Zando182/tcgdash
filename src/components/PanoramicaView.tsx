import { useMemo, useState } from 'react'
import { dataIt, pct } from '../lib/format'
import {
  andamentoSettimanale,
  confronta,
  filtriAttivi,
  raggruppa,
  riepiloga,
  settimaneComplete,
} from '../lib/stats'
import { useFiltri } from '../store/useFiltri'
import type { Match } from '../types'
import { BarreWinrate, Ciambella, GraficoAndamento, GraficoVolume } from './charts'
import { Section, Stat, Vuoto, Winrate } from './ui'

/**
 * Prima pagina: come sto andando, con che mazzi e contro chi.
 * Le barre sono cliccabili e agiscono sui filtri globali, cosi' da un colpo
 * d'occhio si scende subito nel dettaglio di un mazzo o di un matchup.
 */
export function PanoramicaView({ match }: { match: Match[] }) {
  const { filtri, soloQuesto } = useFiltri()
  const [nascoste] = useState<Set<string>>(new Set())

  const r = useMemo(() => riepiloga(match), [match])
  const settimane = useMemo(() => settimaneComplete(match), [match])
  const complessivo = useMemo(
    () => andamentoSettimanale(match, null, settimane),
    [match, settimane],
  )
  const perDeck = useMemo(() => raggruppa(match, 'deck'), [match])
  const perAvversario = useMemo(() => raggruppa(match, 'avversario'), [match])
  const perTag = useMemo(() => raggruppa(match, 'tag'), [match])
  const confrontoDeck = useMemo(() => confronta(match, 'deck'), [match])

  if (match.length === 0) {
    return <Vuoto testo="Nessun match con questi filtri: allarga la selezione o inseriscine uno nuovo." />
  }

  const ultimi = [...match].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 12)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Partite" value={r.partite} sub={`${r.vittorie}V · ${r.sconfitte}S`} />
        <Stat
          label="Winrate"
          value={pct(r.winrate)}
          tone={r.winrate !== null && r.winrate >= 0.55 ? 'good' : r.winrate !== null && r.winrate < 0.45 ? 'bad' : 'default'}
          // Qualunque filtro, non solo mazzo o avversario: con il filtro Torneo
          // (per esempio solo i Challenge) il numero non e' piu' quello di tutto il registro.
          sub={filtriAttivi(filtri) > 0 ? 'sul filtro attivo' : 'su tutto il registro'}
        />
        <Stat
          label="Da 1° (inizio io)"
          value={pct(r.primo.winrate)}
          sub={`${r.primo.partite} partite`}
          tone={r.primo.winrate !== null && r.primo.winrate >= 0.55 ? 'good' : 'default'}
        />
        <Stat
          label="Da 2° (rispondo)"
          value={pct(r.secondo.winrate)}
          sub={`${r.secondo.partite} partite`}
          tone={r.secondo.winrate !== null && r.secondo.winrate < 0.45 ? 'bad' : 'default'}
        />
        <Stat
          label="Serie in corso"
          value={r.streak ? `${r.streak.lunghezza}${r.streak.tipo}` : '—'}
          sub={r.streak ? (r.streak.tipo === 'W' ? 'vittorie di fila' : 'sconfitte di fila') : undefined}
          tone={r.streak?.tipo === 'W' ? 'good' : r.streak?.tipo === 'L' ? 'bad' : 'default'}
        />
        <Stat
          label="Match annotati"
          value={r.conNote}
          sub={`${pct(r.partite ? r.conNote / r.partite : null, 0)} delle partite`}
          tone={r.conNote === 0 ? 'warn' : 'default'}
        />
      </div>

      <Section
        title="Winrate per settimana"
        hint="Il punto e' il winrate della singola settimana; il diametro cresce col numero di partite. Sotto, quante partite hai giocato."
      >
        <GraficoAndamento
          serie={complessivo}
          settimane={settimane}
          nascoste={nascoste}
          onCommuta={() => {}}
          altezza={230}
        />
        {complessivo[0] && (
          <div className="border-t border-ink-700/70 pt-1">
            <GraficoVolume serie={complessivo[0]} settimane={settimane} />
          </div>
        )}
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="I miei mazzi" hint="Clicca una riga per filtrare tutta la dashboard su quel mazzo.">
          <BarreWinrate
            righe={perDeck}
            onClick={(k) => soloQuesto('deck', k)}
            attivo={filtri.deck}
          />
        </Section>

        <Section title="Vittorie e sconfitte">
          <div className="flex items-center gap-5 p-4">
            <Ciambella vittorie={r.vittorie} sconfitte={r.sconfitte} />
            <div className="space-y-2 text-sm">
              <Riga etichetta="Vittorie" valore={`${r.vittorie}`} colore="text-win" />
              <Riga etichetta="Sconfitte" valore={`${r.sconfitte}`} colore="text-loss" />
              <Riga
                etichetta="Scarto 1° / 2°"
                valore={
                  r.primo.winrate !== null && r.secondo.winrate !== null
                    ? pct(r.primo.winrate - r.secondo.winrate, 1)
                    : '—'
                }
                colore="text-ink-100"
              />
              <Riga etichetta="Mazzi diversi" valore={`${perDeck.length}`} colore="text-ink-100" />
              <Riga etichetta="Avversari diversi" valore={`${perAvversario.length}`} colore="text-ink-100" />
            </div>
          </div>
        </Section>
      </div>

      <Section
        title="Confronto tra mazzi"
        hint="Lo stesso quadro che nel workbook stava nel foglio Dashboard, filtri compresi. Clicca una riga per restringere tutta la dashboard a quel mazzo."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-[11px] tracking-wide text-ink-400 uppercase">
              <tr className="border-b border-ink-700/70">
                <th className="px-3 py-2 text-left font-medium">Mazzo</th>
                <th className="px-2 py-2 text-right font-medium">Partite</th>
                <th className="px-2 py-2 text-right font-medium">V</th>
                <th className="px-2 py-2 text-right font-medium">S</th>
                <th className="px-2 py-2 text-right font-medium">Winrate</th>
                <th className="px-2 py-2 text-right font-medium">Da 1°</th>
                <th className="px-3 py-2 text-right font-medium">Da 2°</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/40">
              {confrontoDeck.map((d) => (
                <tr
                  key={d.chiave}
                  onClick={() => soloQuesto('deck', d.chiave)}
                  className={`cursor-pointer hover:bg-ink-850 ${
                    filtri.deck.includes(d.chiave) ? 'bg-sky-500/10' : ''
                  }`}
                >
                  <td className="px-3 py-1.5 text-ink-100">{d.chiave}</td>
                  <td className="px-2 py-1.5 text-right text-ink-300">{d.partite}</td>
                  <td className="px-2 py-1.5 text-right text-win">{d.vittorie}</td>
                  <td className="px-2 py-1.5 text-right text-loss">{d.sconfitte}</td>
                  <td className="px-2 py-1.5 text-right">
                    <Winrate wr={d.winrate} partite={d.partite} />
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <Winrate wr={d.primo.winrate} partite={d.primo.partite} />
                    <span className="ml-1 text-[10px] text-ink-400">({d.primo.partite})</span>
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <Winrate wr={d.secondo.winrate} partite={d.secondo.partite} />
                    <span className="ml-1 text-[10px] text-ink-400">({d.secondo.partite})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section
          title="Mazzi avversari piu' incontrati"
          hint="Clicca per filtrare sul matchup. Sotto le 3 partite il winrate resta grigio: campione troppo piccolo."
        >
          <div className="max-h-96 overflow-y-auto">
            <BarreWinrate
              righe={perAvversario.slice(0, 25)}
              onClick={(k) => soloQuesto('avversario', k)}
              attivo={filtri.avversario}
            />
          </div>
        </Section>

        <Section title="Tag" hint="Come sono andate le partite marcate con ogni tag.">
          <div className="max-h-96 overflow-y-auto">
            {perTag.length === 0 ? (
              <Vuoto testo="Nessun tag su questi match." />
            ) : (
              <BarreWinrate righe={perTag} onClick={(k) => soloQuesto('tag', k)} attivo={filtri.tag} />
            )}
          </div>
        </Section>
      </div>

      <Section title="Ultimi match" hint="Le note compaiono per intero: sono il motivo per cui vale la pena registrarle.">
        <ul className="divide-y divide-ink-700/40">
          {ultimi.map((m) => (
            <li key={m.id} className="flex gap-3 px-3 py-2">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                  m.risultato === 'W' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'
                }`}
              >
                {m.risultato}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium text-ink-100">{m.deck}</span>
                  <span className="text-ink-400">vs</span>
                  <span className="text-ink-100">{m.avversario}</span>
                  <span className="text-[11px] text-ink-400">
                    {dataIt(m.data)} · {m.turno ? `${m.turno}°` : 'turno n.d.'}
                    {m.decklist ? ` · ${m.decklist}` : ''}
                  </span>
                </div>
                {m.tag.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.tag.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {m.note && (
                  <p className="mt-1 border-l-2 border-amber-400/50 pl-2 text-[13px] leading-snug text-amber-100/90">
                    {m.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Riga({ etichetta, valore, colore }: { etichetta: string; valore: string; colore: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-ink-400">{etichetta}</span>
      <span className={`font-semibold ${colore}`}>{valore}</span>
    </div>
  )
}
