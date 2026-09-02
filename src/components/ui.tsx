import { useEffect, useRef, useState, type ReactNode } from 'react'
import { pct } from '../lib/format'

/**
 * Colore del winrate sulla scala rosso -> giallo -> verde del workbook.
 * Sotto le 3 partite il campione non dice niente: resta grigio, cosi' un 1/1
 * non sembra un matchup dominato.
 */
export function toneWinrate(wr: number | null, partite = 99): string {
  if (wr === null) return 'text-ink-400'
  if (partite < 3) return 'text-ink-300'
  if (wr >= 0.65) return 'text-win'
  if (wr >= 0.5) return 'text-amber-300'
  if (wr >= 0.35) return 'text-orange-400'
  return 'text-loss'
}

/**
 * Fondo della cella matchup, sulla stessa scala rosso -> giallo -> verde.
 * Il colore e' calcolato (non una classe Tailwind) per avere una sfumatura
 * continua; l'opacita' cresce col numero di partite, cosi' una cella da 1
 * partita resta smorta e non attira l'occhio come un matchup consolidato.
 */
export function sfondoWinrate(wr: number | null, partite: number): string {
  if (wr === null || partite === 0) return 'transparent'
  const opacita = Math.min(0.85, 0.22 + partite * 0.09)
  // 0 -> rosso (0°), 0.5 -> giallo (55°), 1 -> verde (140°)
  const tinta = wr < 0.5 ? wr * 2 * 55 : 55 + (wr - 0.5) * 2 * 85
  return `hsl(${tinta.toFixed(0)} 62% 42% / ${opacita.toFixed(2)})`
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'default' | 'good' | 'bad' | 'warn'
}) {
  const toneCls =
    tone === 'good'
      ? 'text-win'
      : tone === 'bad'
        ? 'text-loss'
        : tone === 'warn'
          ? 'text-amber-400'
          : 'text-ink-100'
  return (
    <div className="card px-3 py-2.5">
      <div className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">{label}</div>
      <div className={`mt-0.5 text-xl leading-tight font-semibold ${toneCls}`}>{value}</div>
      {sub != null && <div className="mt-0.5 text-[11px] text-ink-400">{sub}</div>}
    </div>
  )
}

export function Section({
  title,
  hint,
  right,
  children,
  className = '',
}: {
  title: string
  hint?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {/* Su schermo stretto il contenuto di `right` (campi, selettori) va a capo
          sotto il titolo invece di schiacciarlo. */}
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-ink-700/70 px-3 py-2">
        <div className="min-w-48 flex-1">
          <h2 className="text-xs font-semibold tracking-wide text-ink-300 uppercase">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  )
}

/** Barra vittorie/sconfitte proporzionale. */
export function BarraEsiti({ vittorie, sconfitte }: { vittorie: number; sconfitte: number }) {
  const tot = vittorie + sconfitte
  if (tot === 0) return <div className="h-1.5 w-full rounded-full bg-ink-800" />
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
      <div className="bg-win" style={{ width: `${(vittorie / tot) * 100}%` }} />
      <div className="bg-loss" style={{ width: `${(sconfitte / tot) * 100}%` }} />
    </div>
  )
}

export function Winrate({ wr, partite }: { wr: number | null; partite: number }) {
  return <span className={`font-semibold ${toneWinrate(wr, partite)}`}>{pct(wr)}</span>
}

export function Vuoto({ testo }: { testo: string }) {
  return <div className="px-3 py-10 text-center text-sm text-ink-400">{testo}</div>
}

/**
 * Campo di testo con suggerimenti: la lista nativa <datalist> lascia scrivere
 * valori nuovi (deck mai giocato, avversario nuovo) senza dover prima
 * censirli, ma propone quelli gia' usati per non creare doppioni.
 */
export function CampoConElenco({
  id,
  valore,
  onChange,
  opzioni,
  placeholder,
  required,
  className = '',
}: {
  id: string
  valore: string
  onChange: (v: string) => void
  opzioni: string[]
  placeholder?: string
  required?: boolean
  className?: string
}) {
  return (
    <>
      <input
        className={`field w-full ${className}`}
        list={`${id}-opzioni`}
        value={valore}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <datalist id={`${id}-opzioni`}>
        {opzioni.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}

/** Menu a discesa con checkbox, per i filtri a scelta multipla. */
export function MultiSelect({
  etichetta,
  opzioni,
  scelti,
  onCommuta,
  onAzzera,
}: {
  etichetta: string
  opzioni: { valore: string; conteggio: number }[]
  scelti: string[]
  onCommuta: (v: string) => void
  onAzzera: () => void
}) {
  const [aperto, setAperto] = useState(false)
  const [cerca, setCerca] = useState('')
  const box = useRef<HTMLDivElement>(null)

  // Chiude cliccando fuori: senza questo restano aperti piu' menu insieme.
  useEffect(() => {
    if (!aperto) return
    const fuori = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setAperto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAperto(false)
    document.addEventListener('mousedown', fuori)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuori)
      document.removeEventListener('keydown', esc)
    }
  }, [aperto])

  const filtrate = cerca.trim()
    ? opzioni.filter((o) => o.valore.toLowerCase().includes(cerca.toLowerCase()))
    : opzioni

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors ${
          scelti.length
            ? 'border-sky-500/60 bg-sky-500/10 text-sky-100'
            : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600'
        }`}
      >
        <span className="truncate">
          <span className="text-[11px] tracking-wide text-ink-400 uppercase">{etichetta}</span>
          <span className="ml-1.5">
            {scelti.length === 0 ? 'tutti' : scelti.length === 1 ? scelti[0] : `${scelti.length} scelti`}
          </span>
        </span>
        <span className="text-ink-400">{aperto ? '▴' : '▾'}</span>
      </button>

      {aperto && (
        <div className="absolute z-30 mt-1 max-h-80 w-full min-w-56 overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-2xl shadow-black/60">
          <div className="flex items-center gap-1.5 border-b border-ink-700/70 p-1.5">
            <input
              className="field w-full py-1 text-xs"
              placeholder="cerca..."
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              autoFocus
            />
            <button type="button" className="btn px-2 py-1 text-xs" onClick={onAzzera}>
              Pulisci
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtrate.length === 0 && <div className="px-3 py-3 text-xs text-ink-400">Nessun valore.</div>}
            {filtrate.map((o) => (
              <label
                key={o.valore}
                className="flex cursor-pointer items-center gap-2 px-2.5 py-1 text-sm hover:bg-ink-800"
              >
                <input
                  type="checkbox"
                  className="accent-sky-500"
                  checked={scelti.includes(o.valore)}
                  onChange={() => onCommuta(o.valore)}
                />
                <span className="flex-1 truncate">{o.valore}</span>
                <span className="text-[11px] text-ink-400">{o.conteggio}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
