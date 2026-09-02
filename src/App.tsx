import { useEffect, useMemo, useState } from 'react'
import { AndamentoView } from './components/AndamentoView'
import { BarraFiltri } from './components/BarraFiltri'
import { DatiView } from './components/DatiView'
import { InserisciView } from './components/InserisciView'
import { MatchupView } from './components/MatchupView'
import { NoteView } from './components/NoteView'
import { PanoramicaView } from './components/PanoramicaView'
import { pct } from './lib/format'
import { applicaFiltri, riepiloga } from './lib/stats'
import { useFiltri } from './store/useFiltri'
import { useRegistro } from './store/useMatch'

type Pagina = 'inserisci' | 'panoramica' | 'andamento' | 'matchup' | 'note' | 'dati'

const PAGINE: { id: Pagina; etichetta: string; icona: string }[] = [
  { id: 'inserisci', etichetta: 'Inserisci', icona: '✍️' },
  { id: 'panoramica', etichetta: 'Panoramica', icona: '📊' },
  { id: 'andamento', etichetta: 'Andamento', icona: '📈' },
  { id: 'matchup', etichetta: 'Matchup', icona: '🧩' },
  { id: 'note', etichetta: 'Note', icona: '📝' },
  { id: 'dati', etichetta: 'Dati', icona: '💾' },
]

// La pagina inserisci ha una barra filtri sua, sopra il registro; le altre la
// prendono dal guscio. La pagina dati non filtra niente: mostra tutto.
const CON_FILTRI: Pagina[] = ['panoramica', 'andamento', 'matchup', 'note']

export default function App() {
  const { match, salvataggioAttivo } = useRegistro()
  const { filtri } = useFiltri()
  const [pagina, setPagina] = useState<Pagina>(leggiHash())

  // L'hash tiene la pagina nell'URL: ricaricando si resta dov'eri, e i tasti
  // avanti/indietro del browser funzionano.
  useEffect(() => {
    const cambio = () => setPagina(leggiHash())
    window.addEventListener('hashchange', cambio)
    return () => window.removeEventListener('hashchange', cambio)
  }, [])

  const vai = (p: Pagina) => {
    window.location.hash = p
    setPagina(p)
  }

  const filtrati = useMemo(() => applicaFiltri(match, filtri), [match, filtri])
  const r = useMemo(() => riepiloga(filtrati), [filtrati])

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <h1 className="text-base font-bold tracking-tight">
            TCG<span className="text-sky-400">Dash</span>
          </h1>

          <nav className="flex flex-wrap gap-1">
            {PAGINE.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => vai(p.id)}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  pagina === p.id
                    ? 'bg-sky-500/15 text-sky-200'
                    : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100'
                }`}
              >
                <span className="mr-1">{p.icona}</span>
                {p.etichetta}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-ink-400">
              {r.partite} match
              {r.partite !== match.length && <span className="text-ink-600"> / {match.length}</span>}
            </span>
            <span className="font-semibold text-ink-100">
              WR <span className={r.winrate !== null && r.winrate >= 0.5 ? 'text-win' : 'text-loss'}>{pct(r.winrate)}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4">
        {!salvataggioAttivo && pagina !== 'dati' && (
          <div className="card border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Salvataggio locale bloccato dal browser: i match inseriti non resteranno alla ricarica.
            Dettagli e backup nella pagina <button type="button" className="underline" onClick={() => vai('dati')}>Dati</button>.
          </div>
        )}

        {CON_FILTRI.includes(pagina) && <BarraFiltri match={match} />}

        {pagina === 'inserisci' && <InserisciView />}
        {pagina === 'panoramica' && <PanoramicaView match={filtrati} />}
        {pagina === 'andamento' && <AndamentoView match={filtrati} />}
        {pagina === 'matchup' && <MatchupView match={filtrati} />}
        {pagina === 'note' && <NoteView match={filtrati} />}
        {pagina === 'dati' && <DatiView />}
      </main>

      <footer className="mx-auto max-w-[1600px] px-4 pb-6 text-[11px] text-ink-600">
        TCGDash — registro locale, nessun account e nessun server: i dati restano nel browser di
        questo PC. Backup dalla pagina Dati.
      </footer>
    </div>
  )
}

function leggiHash(): Pagina {
  const h = window.location.hash.replace('#', '')
  return PAGINE.some((p) => p.id === h) ? (h as Pagina) : 'panoramica'
}
