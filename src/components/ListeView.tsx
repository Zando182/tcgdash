import { useMemo, useState } from 'react'
import { dataIt, normalizza, perNome } from '../lib/format'
import { liste as elenchiDa, useRegistro } from '../store/useMatch'
import type { Lista } from '../types'
import { CampoConElenco, Section, Vuoto } from './ui'

type Bozza = { id?: string; nome: string; mazzo: string; testo: string }

const BOZZA_VUOTA: Bozza = { nome: '', mazzo: '', testo: '' }

/**
 * Le liste dei mazzi, come testo e basta.
 *
 * Non si conta niente e non si controlla niente: il testo incollato viene
 * salvato tale e quale, virgole, righe vuote e refusi compresi. Un parser
 * fallirebbe sul primo formato diverso (PTCGL, Limitless, appunti a mano) e
 * qui l'unica cosa che serve davvero e' ritrovare cosa c'era nel mazzo.
 */
export function ListeView() {
  const { match, decklist, extra, salvaLista, eliminaLista } = useRegistro()
  const [bozza, setBozza] = useState<Bozza>(BOZZA_VUOTA)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [cerca, setCerca] = useState('')
  const [aperte, setAperte] = useState<Set<string>>(new Set())
  const [daEliminare, setDaEliminare] = useState<string | null>(null)

  const elenchi = useMemo(() => elenchiDa(match, extra), [match, extra])

  /**
   * Nomi di lista usati nei match che non hanno ancora un testo salvato.
   * Sono il suggerimento della pagina: hai giocato 13 partite con "Dragapolli
   * v2" ma non hai mai scritto cosa c'era dentro.
   */
  const daCreare = useMemo(() => {
    const salvate = new Set(decklist.map((l) => normalizza(l.nome)).filter(Boolean))
    const conta = new Map<string, { partite: number; mazzo: string }>()
    for (const m of match) {
      if (!m.decklist || salvate.has(normalizza(m.decklist))) continue
      const v = conta.get(m.decklist) ?? { partite: 0, mazzo: m.deck }
      v.partite++
      conta.set(m.decklist, v)
    }
    return [...conta.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.partite - a.partite || perNome(a.nome, b.nome))
  }, [match, decklist])

  const mostrate = useMemo(() => {
    const q = normalizza(cerca)
    const ordinate = [...decklist].sort(
      (a, b) => (a.aggiornata < b.aggiornata ? 1 : a.aggiornata > b.aggiornata ? -1 : 0),
    )
    if (!q) return ordinate
    return ordinate.filter((l) => normalizza(`${l.nome} ${l.mazzo} ${l.testo}`).includes(q))
  }, [decklist, cerca])

  /** Quante partite ha alle spalle una lista salvata. */
  const partiteDi = (nome: string) =>
    match.filter((m) => normalizza(m.decklist) === normalizza(nome)).length

  const salva = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bozza.nome.trim() && !bozza.testo.trim()) {
      setMessaggio('Serve almeno un nome o il testo della lista.')
      return
    }
    salvaLista(bozza)
    setMessaggio(bozza.id ? 'Lista aggiornata.' : `Lista "${bozza.nome || 'senza nome'}" salvata.`)
    setBozza(BOZZA_VUOTA)
  }

  const apriModifica = (l: Lista) => {
    setBozza({ id: l.id, nome: l.nome, mazzo: l.mazzo, testo: l.testo })
    setMessaggio(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const commuta = (id: string) =>
    setAperte((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const righe = (t: string) => t.split('\n').filter((r) => r.trim()).length

  return (
    <div className="space-y-3">
      <Section
        title={bozza.id ? 'Modifica lista' : 'Incolla una lista'}
        hint="Incolla e basta: il testo viene salvato com'e', in qualunque formato. Nessun controllo, nessun conteggio."
        right={
          bozza.id ? (
            <button type="button" className="btn text-xs" onClick={() => setBozza(BOZZA_VUOTA)}>
              Annulla modifica
            </button>
          ) : undefined
        }
      >
        <form onSubmit={salva} className="space-y-3 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">
                Nome della lista
              </span>
              <span className="mt-0.5 block text-[11px] text-ink-400">
                Lo stesso che scrivi in “Lista usata” quando inserisci un match: così la lista si
                lega alle partite.
              </span>
              <div className="mt-1">
                <CampoConElenco
                  id="lista-nome"
                  valore={bozza.nome}
                  onChange={(v) => setBozza((b) => ({ ...b, nome: v }))}
                  opzioni={elenchi.decklist}
                  placeholder="es. Dragapolli v3"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">
                Mazzo
              </span>
              <span className="mt-0.5 block text-[11px] text-ink-400">Facoltativo.</span>
              <div className="mt-1">
                <CampoConElenco
                  id="lista-mazzo"
                  valore={bozza.mazzo}
                  onChange={(v) => setBozza((b) => ({ ...b, mazzo: v }))}
                  opzioni={elenchi.deck}
                  placeholder="es. Dragapult ex Blaziken ex"
                />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">
              La lista
            </span>
            <textarea
              className="field mt-1 min-h-64 w-full resize-y font-mono text-[13px] leading-relaxed"
              placeholder={'Incolla qui la lista, da PTCGL, da Limitless o scritta a mano.\n\nVa bene qualunque formato: non viene letta, solo conservata.'}
              value={bozza.testo}
              onChange={(e) => setBozza((b) => ({ ...b, testo: e.target.value }))}
              spellCheck={false}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary">
              {bozza.id ? 'Salva modifiche' : 'Salva lista'}
            </button>
            <button type="button" className="btn" onClick={() => setBozza(BOZZA_VUOTA)}>
              Svuota
            </button>
            {bozza.testo && (
              <span className="text-[11px] text-ink-400">
                {righe(bozza.testo)} righe, {bozza.testo.length} caratteri
              </span>
            )}
            {messaggio && <span className="text-xs text-ink-300">{messaggio}</span>}
          </div>
        </form>
      </Section>

      {daCreare.length > 0 && (
        <Section
          title="Liste che hai giocato ma non ancora scritto"
          hint="Nomi che compaiono nei tuoi match e che non hanno un testo salvato. Clicca per cominciare a scriverne una."
        >
          <div className="flex flex-wrap gap-1.5 p-3">
            {daCreare.map((d) => (
              <button
                key={d.nome}
                type="button"
                className="chip"
                onClick={() => {
                  setBozza({ nome: d.nome, mazzo: d.mazzo, testo: '' })
                  setMessaggio(null)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                {d.nome}
                <span className="text-ink-500">
                  {d.partite} {d.partite === 1 ? 'partita' : 'partite'}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Le mie liste"
        hint="Clicca il titolo per aprire una lista."
        right={
          <div className="flex items-center gap-2">
            <input
              className="field w-48 py-1 text-xs"
              placeholder="cerca una carta…"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
            />
            <span className="text-[11px] whitespace-nowrap text-ink-400">
              {mostrate.length}
              {mostrate.length !== decklist.length && ` di ${decklist.length}`}
            </span>
          </div>
        }
      >
        {decklist.length === 0 ? (
          <Vuoto testo="Nessuna lista salvata. Incollane una qui sopra: la ritrovi qui sotto." />
        ) : mostrate.length === 0 ? (
          <Vuoto testo={`Nessuna lista contiene “${cerca}”.`} />
        ) : (
          <ul className="divide-y divide-ink-700/50">
            {mostrate.map((l) => {
              const aperta = aperte.has(l.id)
              const n = partiteDi(l.nome)
              return (
                <li key={l.id}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => commuta(l.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="w-3 shrink-0 text-ink-400">{aperta ? '▾' : '▸'}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-100">
                          {l.nome || <span className="text-ink-400">(senza nome)</span>}
                        </span>
                        <span className="block text-[11px] text-ink-400">
                          {[
                            l.mazzo,
                            `${righe(l.testo)} righe`,
                            n > 0 ? `${n} ${n === 1 ? 'partita' : 'partite'}` : null,
                            l.aggiornata ? `aggiornata il ${dataIt(l.aggiornata)}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </button>

                    <span className="flex shrink-0 gap-1">
                      {daEliminare === l.id ? (
                        <>
                          <button
                            type="button"
                            className="rounded border border-loss/60 bg-loss/20 px-2 py-0.5 text-xs font-semibold text-loss"
                            onClick={() => {
                              eliminaLista(l.id)
                              setDaEliminare(null)
                            }}
                          >
                            Confermi?
                          </button>
                          <button
                            type="button"
                            className="btn px-2 py-0.5 text-xs"
                            onClick={() => setDaEliminare(null)}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn px-2 py-0.5 text-xs"
                            onClick={() => apriModifica(l)}
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            className="btn px-2 py-0.5 text-xs"
                            onClick={() => setDaEliminare(l.id)}
                          >
                            Elimina
                          </button>
                        </>
                      )}
                    </span>
                  </div>

                  {aperta && (
                    <pre className="mx-3 mb-3 overflow-x-auto rounded-lg border border-ink-700/70 bg-ink-850 px-3 py-2.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-ink-100">
                      {l.testo || <span className="text-ink-400">(vuota)</span>}
                    </pre>
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
