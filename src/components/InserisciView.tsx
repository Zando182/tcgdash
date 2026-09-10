import { useMemo, useState } from 'react'
import { dataIt, oggiIso } from '../lib/format'
import { applicaFiltri } from '../lib/stats'
import { useFiltri } from '../store/useFiltri'
import { liste, useRegistro, useTutteLePartite } from '../store/useMatch'
import type { Esito, Match, Turno } from '../types'
import { BarraFiltri } from './BarraFiltri'
import { CampoConElenco, Section, Vuoto } from './ui'

type Bozza = Omit<Match, 'id'>

function bozzaVuota(ultimo?: Match): Bozza {
  return {
    data: oggiIso(),
    // I campi che cambiano di rado si ereditano dall'ultima partita inserita:
    // in una sessione di ladder si cambia solo avversario, turno ed esito.
    formato: ultimo?.formato ?? '',
    deck: ultimo?.deck ?? '',
    decklist: ultimo?.decklist ?? '',
    torneo: ultimo?.torneo ?? '',
    avversario: '',
    turno: null,
    risultato: 'W',
    tag: [],
    note: '',
  }
}

export function InserisciView() {
  const { match, extra, aggiungi, modifica, elimina, duplica } = useRegistro()
  const { filtri } = useFiltri()
  // I suggerimenti comprendono anche mazzi e avversari incontrati nei tornei.
  const tutte = useTutteLePartite()
  const elenchi = useMemo(() => liste(tutte, extra), [tutte, extra])

  const [bozza, setBozza] = useState<Bozza>(() => bozzaVuota(match[0]))
  const [inModifica, setInModifica] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [tagLibero, setTagLibero] = useState('')

  const filtrati = useMemo(() => applicaFiltri(match, filtri), [match, filtri])

  const campo = <K extends keyof Bozza>(k: K, v: Bozza[K]) => setBozza((b) => ({ ...b, [k]: v }))

  const salva = (e: React.FormEvent) => {
    e.preventDefault()
    const pulita: Bozza = {
      ...bozza,
      deck: bozza.deck.trim(),
      avversario: bozza.avversario.trim(),
      decklist: bozza.decklist.trim(),
      formato: bozza.formato.trim(),
      torneo: bozza.torneo.trim(),
      note: bozza.note.trim(),
      tag: [...bozza.tag, ...tagLibero.split(',').map((t) => t.trim())].filter(
        (t, i, a) => t && a.indexOf(t) === i,
      ),
    }
    if (!pulita.deck || !pulita.avversario || !pulita.data) {
      setMessaggio('Servono almeno data, mazzo e mazzo avversario.')
      return
    }

    if (inModifica) {
      modifica(inModifica, pulita)
      setMessaggio('Match aggiornato.')
      setInModifica(null)
    } else {
      aggiungi(pulita)
      setMessaggio(`Match salvato: ${pulita.deck} vs ${pulita.avversario} — ${pulita.risultato}.`)
    }
    setBozza(bozzaVuota({ ...pulita, id: '' }))
    setTagLibero('')
  }

  const apriModifica = (m: Match) => {
    const { id: _id, ...resto } = m
    setBozza(resto)
    setTagLibero('')
    setInModifica(m.id)
    setMessaggio(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const annulla = () => {
    setInModifica(null)
    setBozza(bozzaVuota(match[0]))
    setTagLibero('')
    setMessaggio(null)
  }

  return (
    <div className="space-y-3">
      <Section
        title={inModifica ? 'Modifica match' : 'Nuovo match'}
        hint="I campi si ricordano dell'ultima partita inserita: in una sessione cambi solo avversario, turno ed esito."
        right={
          inModifica ? (
            <button type="button" className="btn text-xs" onClick={annulla}>
              Annulla modifica
            </button>
          ) : undefined
        }
      >
        <form onSubmit={salva} className="space-y-3 p-3">
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
                id="formato"
                valore={bozza.formato}
                onChange={(v) => campo('formato', v)}
                opzioni={elenchi.formato}
                placeholder="es. TEF-PBL"
              />
            </Campo>

            <Campo etichetta="Il mio mazzo *">
              <CampoConElenco
                id="deck"
                valore={bozza.deck}
                onChange={(v) => campo('deck', v)}
                opzioni={elenchi.deck}
                required
                placeholder="es. Dragapult ex Blaziken ex"
              />
            </Campo>

            <Campo etichetta="Lista usata">
              <CampoConElenco
                id="decklist"
                valore={bozza.decklist}
                onChange={(v) => campo('decklist', v)}
                opzioni={elenchi.decklist}
                placeholder="es. Dragapolli v3"
              />
            </Campo>

            <Campo etichetta="Mazzo avversario *">
              <CampoConElenco
                id="avversario"
                valore={bozza.avversario}
                onChange={(v) => campo('avversario', v)}
                opzioni={elenchi.avversario}
                required
                placeholder="es. MegaLucario ex"
              />
            </Campo>

            <Campo etichetta="Torneo / piattaforma">
              <CampoConElenco
                id="torneo"
                valore={bozza.torneo}
                onChange={(v) => campo('torneo', v)}
                opzioni={elenchi.torneo}
                placeholder="es. TCGLive"
              />
            </Campo>

            <Campo etichetta="Chi inizia">
              <div className="flex gap-1.5">
                {([1, 2] as Turno[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => campo('turno', bozza.turno === t ? null : t)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-sm transition-colors ${
                      bozza.turno === t
                        ? 'border-sky-500/60 bg-sky-500/15 font-semibold text-sky-100'
                        : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600'
                    }`}
                  >
                    {t === 1 ? '1° · inizio io' : '2° · rispondo'}
                  </button>
                ))}
              </div>
            </Campo>

            <Campo etichetta="Risultato *">
              <div className="flex gap-1.5">
                {(['W', 'L'] as Esito[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => campo('risultato', r)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-semibold transition-colors ${
                      bozza.risultato === r
                        ? r === 'W'
                          ? 'border-win/60 bg-win/20 text-win'
                          : 'border-loss/60 bg-loss/20 text-loss'
                        : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600'
                    }`}
                  >
                    {r === 'W' ? 'Vittoria' : 'Sconfitta'}
                  </button>
                ))}
              </div>
            </Campo>
          </div>

          <Campo etichetta="Tag">
            <div className="flex flex-wrap gap-1.5">
              {elenchi.tag.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={bozza.tag.includes(t) ? 'chip-on' : 'chip'}
                  onClick={() =>
                    campo('tag', bozza.tag.includes(t) ? bozza.tag.filter((x) => x !== t) : [...bozza.tag, t])
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              className="field mt-2 w-full"
              placeholder="Altri tag, separati da virgola (es. Bad Start, Punizione mulligan)"
              value={tagLibero}
              onChange={(e) => setTagLibero(e.target.value)}
            />
          </Campo>

          {/* La nota e' il pezzo di valore della dashboard: sta grande e in
              fondo, e ha una pagina dedicata dove ritrovarla per matchup. */}
          <Campo
            etichetta="Note della partita"
            aiuto="Cosa hai imparato: linee, carte chiave, errori. Finiscono nella pagina Note, raggruppate per matchup."
          >
            <textarea
              className="field min-h-24 w-full resize-y leading-relaxed"
              placeholder="es. Doppio Froslass, tieni un premio di board. Attento allo Stamp al turno 3."
              value={bozza.note}
              onChange={(e) => campo('note', e.target.value)}
            />
          </Campo>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary">
              {inModifica ? 'Salva modifiche' : 'Aggiungi match'}
            </button>
            <button type="button" className="btn" onClick={annulla}>
              Svuota
            </button>
            {messaggio && <span className="text-xs text-ink-300">{messaggio}</span>}
          </div>
        </form>
      </Section>

      <BarraFiltri match={match} />

      <Section
        title="Registro match"
        hint="Ordinato dal piu' recente. Le partite dei tornei non sono qui: si modificano da Inserisci torneo."
        right={
          <span className="text-[11px] text-ink-400">
            {filtrati.length} di {match.length} match
          </span>
        }
      >
        {filtrati.length === 0 ? (
          <Vuoto testo="Nessun match con questi filtri." />
        ) : (
          <TabellaMatch
            match={filtrati}
            onModifica={apriModifica}
            onDuplica={duplica}
            onElimina={elimina}
          />
        )}
      </Section>
    </div>
  )
}

function Campo({
  etichetta,
  aiuto,
  children,
}: {
  etichetta: string
  aiuto?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">{etichetta}</span>
      {aiuto && <span className="mt-0.5 block text-[11px] text-ink-400">{aiuto}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function TabellaMatch({
  match,
  onModifica,
  onDuplica,
  onElimina,
}: {
  match: Match[]
  onModifica: (m: Match) => void
  onDuplica: (id: string) => void
  onElimina: (id: string) => void
}) {
  const [daEliminare, setDaEliminare] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="sticky top-0 bg-ink-900 text-[11px] tracking-wide text-ink-400 uppercase">
          <tr className="border-b border-ink-700/70">
            <th className="px-3 py-2 text-left font-medium">Data</th>
            <th className="px-2 py-2 text-left font-medium">Mazzo · lista</th>
            <th className="px-2 py-2 text-left font-medium">Avversario</th>
            <th className="px-2 py-2 text-center font-medium">Turno</th>
            <th className="px-2 py-2 text-center font-medium">Esito</th>
            <th className="px-2 py-2 text-left font-medium">Tag</th>
            <th className="px-2 py-2 text-left font-medium">Note</th>
            <th className="px-3 py-2 text-right font-medium">Azioni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700/40">
          {match.map((m) => (
            <tr key={m.id} className="align-top hover:bg-ink-850/60">
              <td className="px-3 py-2 whitespace-nowrap text-ink-300">{dataIt(m.data)}</td>
              <td className="px-2 py-2">
                <div className="font-medium text-ink-100">{m.deck}</div>
                <div className="text-[11px] text-ink-400">
                  {[m.decklist, m.formato, m.torneo].filter(Boolean).join(' · ')}
                </div>
              </td>
              <td className="px-2 py-2 text-ink-100">{m.avversario}</td>
              <td className="px-2 py-2 text-center text-ink-300">{m.turno ? `${m.turno}°` : '—'}</td>
              <td className="px-2 py-2 text-center">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${
                    m.risultato === 'W' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'
                  }`}
                >
                  {m.risultato}
                </span>
              </td>
              <td className="px-2 py-2">
                <div className="flex max-w-40 flex-wrap gap-1">
                  {m.tag.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              </td>
              <td className="max-w-xs px-2 py-2">
                {m.note ? (
                  <p className="text-[13px] leading-snug text-amber-100/90">{m.note}</p>
                ) : (
                  <span className="text-ink-600">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {daEliminare === m.id ? (
                  <span className="inline-flex gap-1">
                    <button
                      type="button"
                      className="rounded border border-loss/60 bg-loss/20 px-2 py-0.5 text-xs font-semibold text-loss"
                      onClick={() => {
                        onElimina(m.id)
                        setDaEliminare(null)
                      }}
                    >
                      Confermi?
                    </button>
                    <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => setDaEliminare(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex gap-1">
                    <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => onModifica(m)}>
                      Modifica
                    </button>
                    <button
                      type="button"
                      className="btn px-2 py-0.5 text-xs"
                      title="Crea una copia da modificare"
                      onClick={() => onDuplica(m.id)}
                    >
                      Duplica
                    </button>
                    <button
                      type="button"
                      className="btn px-2 py-0.5 text-xs"
                      onClick={() => setDaEliminare(m.id)}
                    >
                      Elimina
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
