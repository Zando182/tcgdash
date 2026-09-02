import { useEffect, useMemo, useState } from 'react'
import { BarraFiltri } from './components/BarraFiltri'
import { DatiView } from './components/DatiView'
import { InserisciView } from './components/InserisciView'
import { ListeView } from './components/ListeView'
import { MatchupView } from './components/MatchupView'
import { MetagameView } from './components/MetagameView'
import { NoteView } from './components/NoteView'
import { PanoramicaView } from './components/PanoramicaView'
import { pct } from './lib/format'
import { applicaFiltri, riepiloga } from './lib/stats'
import { useFiltri } from './store/useFiltri'
import { useRegistro } from './store/useMatch'

type Pagina = 'inserisci' | 'panoramica' | 'matchup' | 'note' | 'liste' | 'dati' | 'metagame'
type Sezione = 'mia' | 'metagame'

type VoceSezione = {
  id: Sezione
  etichetta: string
  pagine: { id: Pagina; etichetta: string; icona: string }[]
}

/**
 * La navigazione ha due livelli: le sezioni in alto, le pagine della sezione
 * attiva sotto. La riga delle pagine compare solo dove ce n'e' piu' d'una,
 * cosi' Metagame non mostra una scheda sola tutta sola.
 */
const SEZIONI: VoceSezione[] = [
  {
    id: 'mia',
    etichetta: 'La mia Dashboard',
    pagine: [
      { id: 'inserisci', etichetta: 'Inserisci', icona: '✍️' },
      { id: 'panoramica', etichetta: 'Panoramica', icona: '📊' },
      { id: 'matchup', etichetta: 'Matchup', icona: '🧩' },
      { id: 'note', etichetta: 'Note', icona: '📝' },
      { id: 'liste', etichetta: 'Liste', icona: '🗂️' },
      { id: 'dati', etichetta: 'Dati', icona: '💾' },
    ],
  },
  {
    id: 'metagame',
    etichetta: 'Metagame',
    pagine: [{ id: 'metagame', etichetta: 'Metagame', icona: '🌍' }],
  },
]

const PAGINE = SEZIONI.flatMap((s) => s.pagine.map((p) => ({ ...p, sezione: s.id })))

// Le pagine che leggono i filtri globali. La pagina inserisci ha una barra sua,
// sopra il registro; liste, dati e metagame non filtrano niente.
const CON_FILTRI: Pagina[] = ['panoramica', 'matchup', 'note']

export default function App() {
  const { match, salvataggioAttivo, modo, caricamento, erroreExcel, riprovaSalvataggio, inizializza } =
    useRegistro()
  const { filtri } = useFiltri()
  const [pagina, setPagina] = useState<Pagina>(leggiHash())

  // All'avvio si chiede al server locale se il workbook Excel e' raggiungibile:
  // se lo e', diventa lui il database e il registro viene riletto da li'.
  useEffect(() => {
    void inizializza()
  }, [inizializza])

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

  const sezioneAttiva = PAGINE.find((p) => p.id === pagina)?.sezione ?? 'mia'
  const pagineSezione = SEZIONI.find((s) => s.id === sezioneAttiva)?.pagine ?? []

  const filtrati = useMemo(() => applicaFiltri(match, filtri), [match, filtri])
  const r = useMemo(() => riepiloga(filtrati), [filtrati])
  const inMiaDashboard = sezioneAttiva === 'mia'

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-2.5">
          <h1 className="text-base font-bold tracking-tight">
            TCG<span className="text-sky-400">Dash</span>
          </h1>

          <nav className="flex flex-wrap gap-1" aria-label="Sezioni">
            {SEZIONI.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => vai(s.pagine[0].id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  sezioneAttiva === s.id
                    ? 'bg-ink-800 text-ink-100'
                    : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200'
                }`}
              >
                {s.etichetta}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            {inMiaDashboard && (
              <>
                <span className="text-ink-400">
                  {r.partite} match
                  {r.partite !== match.length && (
                    <span className="text-ink-600"> / {match.length}</span>
                  )}
                </span>
                <span className="font-semibold text-ink-100">
                  WR{' '}
                  <span className={r.winrate !== null && r.winrate >= 0.5 ? 'text-win' : 'text-loss'}>
                    {pct(r.winrate)}
                  </span>
                </span>
              </>
            )}
            {/* Finche' non si sa se il server locale c'e', l'etichetta resta
                neutra: mostrare "browser" per un istante e poi "Excel" farebbe
                credere che il workbook non venga aggiornato. */}
            <button
              type="button"
              onClick={() => vai('dati')}
              title={
                caricamento
                  ? 'Sto cercando il workbook…'
                  : modo === 'excel'
                    ? 'I match vengono scritti su data/TCG_Match.xlsx'
                    : 'I match restano nel browser di questo PC'
              }
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                caricamento
                  ? 'border-ink-700 bg-ink-850 text-ink-600'
                  : modo === 'excel'
                    ? 'border-win/50 bg-win/10 text-win'
                    : 'border-ink-700 bg-ink-850 text-ink-400'
              }`}
            >
              {caricamento ? '…' : modo === 'excel' ? 'Excel' : 'browser'}
            </button>
          </div>
        </div>

        {pagineSezione.length > 1 && (
          <div className="mx-auto max-w-[1600px] px-4 pt-1 pb-2">
            <nav className="flex flex-wrap gap-1" aria-label="Pagine della sezione">
              {pagineSezione.map((p) => (
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
          </div>
        )}
        {pagineSezione.length <= 1 && <div className="pb-2.5" />}
      </header>

      <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4">
        {erroreExcel && (
          <div className="card border-loss/50 bg-loss/10 px-3 py-2 text-sm text-rose-100">
            <strong>Non sono riuscito a scrivere sull'Excel.</strong> Il match e' salvato nel
            browser, quindi non l'hai perso, ma il workbook non e' aggiornato.
            <div className="mt-1 text-[13px] text-rose-200/80">{erroreExcel}</div>
            <button
              type="button"
              className="btn mt-2 text-xs"
              onClick={() => void riprovaSalvataggio()}
            >
              Riprova
            </button>
          </div>
        )}

        {!salvataggioAttivo && pagina !== 'dati' && (
          <div className="card border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Salvataggio locale bloccato dal browser: i match inseriti non resteranno alla ricarica.
            Dettagli e backup nella pagina{' '}
            <button type="button" className="underline" onClick={() => vai('dati')}>
              Dati
            </button>
            .
          </div>
        )}

        {CON_FILTRI.includes(pagina) && <BarraFiltri match={match} />}

        {pagina === 'inserisci' && <InserisciView />}
        {pagina === 'panoramica' && <PanoramicaView match={filtrati} />}
        {pagina === 'matchup' && <MatchupView match={filtrati} />}
        {pagina === 'note' && <NoteView match={filtrati} />}
        {pagina === 'liste' && <ListeView />}
        {pagina === 'dati' && <DatiView />}
        {pagina === 'metagame' && <MetagameView />}
      </main>

      <footer className="mx-auto max-w-[1600px] px-4 pb-6 text-[11px] text-ink-600">
        TCGDash —{' '}
        {modo === 'excel'
          ? 'i match sono scritti su data/TCG_Match.xlsx, che resta il database.'
          : 'registro nel browser di questo PC. Avvia con npm start per scrivere sull’Excel.'}{' '}
        Backup dalla pagina Dati.
      </footer>
    </div>
  )
}

function leggiHash(): Pagina {
  const h = window.location.hash.replace('#', '')
  return PAGINE.some((p) => p.id === h) ? (h as Pagina) : 'panoramica'
}
