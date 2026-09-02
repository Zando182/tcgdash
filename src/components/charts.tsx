import { useId, useState } from 'react'
import { dataBreve, pct } from '../lib/format'
import type { SerieSettimanale } from '../lib/stats'
import { settimanaIso } from '../lib/stats'

/**
 * Tavolozza delle serie. Colori distinguibili anche affiancati e leggibili sul
 * fondo scuro; si ripete se le serie sono piu' di dieci, ma il pannello ne
 * mostra al massimo dieci per volta.
 */
export const COLORI = [
  '#38bdf8',
  '#f472b6',
  '#4ade80',
  '#fbbf24',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#fb923c',
  '#94a3b8',
  '#c084fc',
]

export const coloreSerie = (i: number) => COLORI[i % COLORI.length]

type Punto = { x: number; y: number }

/** Spezzata smussata: curve di Bezier con controlli a meta' segmento. */
function percorso(punti: Punto[]): string {
  if (punti.length === 0) return ''
  if (punti.length === 1) return `M ${punti[0].x} ${punti[0].y}`
  let d = `M ${punti[0].x} ${punti[0].y}`
  for (let i = 1; i < punti.length; i++) {
    const p = punti[i - 1]
    const c = punti[i]
    const mx = (p.x + c.x) / 2
    d += ` C ${mx} ${p.y}, ${mx} ${c.y}, ${c.x} ${c.y}`
  }
  return d
}

export type ModoLinea = 'settimanale' | 'cumulato'

/**
 * Andamento del winrate per settimana, una linea per serie.
 *
 * Le settimane senza partite interrompono la linea (niente punto): unirle
 * darebbe l'illusione di un andamento che non c'e'. Il raggio del punto cresce
 * col numero di partite, cosi' si vede a occhio quali settimane pesano.
 */
export function GraficoAndamento({
  serie,
  settimane,
  modo = 'settimanale',
  nascoste,
  onCommuta,
  altezza = 260,
}: {
  serie: SerieSettimanale[]
  settimane: string[]
  modo?: ModoLinea
  nascoste: Set<string>
  onCommuta: (chiave: string) => void
  altezza?: number
}) {
  const idGrad = useId()
  const [sopra, setSopra] = useState<{ i: number; serie: string } | null>(null)

  const L = 44
  const R = 14
  const T = 12
  const B = 34
  const W = 900
  const H = altezza
  const larghezzaTrama = W - L - R
  const altezzaTrama = H - T - B

  const visibili = serie.filter((s) => !nascoste.has(s.chiave))
  const passo = settimane.length > 1 ? larghezzaTrama / (settimane.length - 1) : 0
  const x = (i: number) => (settimane.length > 1 ? L + i * passo : L + larghezzaTrama / 2)
  const y = (v: number) => T + (1 - v) * altezzaTrama

  // Con molte settimane le etichette si sovrappongono: se ne salta qualcuna.
  const saltoEtichette = Math.max(1, Math.ceil(settimane.length / 14))

  if (settimane.length === 0) {
    return <div className="px-3 py-12 text-center text-sm text-ink-400">Nessuna partita nel periodo.</div>
  }

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: altezza }} role="img">
          <defs>
            <linearGradient id={`${idGrad}-fade`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Griglia orizzontale ogni 25%, con il 50% marcato: e' la soglia
              che separa un matchup favorevole da uno sfavorevole. */}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line
                x1={L}
                x2={W - R}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0.5 ? '#38404f' : '#262c38'}
                strokeWidth={v === 0.5 ? 1.5 : 1}
                strokeDasharray={v === 0.5 ? '5 4' : undefined}
              />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#7c8798">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}

          {/* Etichette settimana */}
          {settimane.map((s, i) =>
            i % saltoEtichette === 0 ? (
              <g key={s}>
                <text x={x(i)} y={H - 16} textAnchor="middle" fontSize="11" fill="#a6b0be">
                  {dataBreve(s)}
                </text>
                <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#7c8798">
                  S{settimanaIso(s)}
                </text>
              </g>
            ) : null,
          )}

          {/* Colonne trasparenti che catturano il passaggio del mouse su tutta
              l'altezza: mirare il singolo punto sarebbe scomodo. */}
          {settimane.map((s, i) => (
            <rect
              key={`hit-${s}`}
              x={x(i) - passo / 2}
              y={T}
              width={Math.max(passo, 14)}
              height={altezzaTrama}
              fill="transparent"
              onMouseEnter={() => setSopra({ i, serie: '' })}
              onMouseLeave={() => setSopra(null)}
            />
          ))}
          {sopra && (
            <line
              x1={x(sopra.i)}
              x2={x(sopra.i)}
              y1={T}
              y2={T + altezzaTrama}
              stroke="#38404f"
              strokeWidth="1"
            />
          )}

          {visibili.map((s) => {
            const i = serie.indexOf(s)
            const colore = coloreSerie(i)
            // Segmenti separati: una settimana senza partite spezza la linea.
            const segmenti: Punto[][] = []
            let corrente: Punto[] = []
            s.punti.forEach((p, idx) => {
              const v = modo === 'cumulato' ? p.cumulato : p.winrate
              const haDati = modo === 'cumulato' ? p.cumulato !== null && p.partite >= 0 : p.partite > 0
              if (v === null || !haDati) {
                if (corrente.length) segmenti.push(corrente)
                corrente = []
                return
              }
              corrente.push({ x: x(idx), y: y(v) })
            })
            if (corrente.length) segmenti.push(corrente)

            return (
              <g key={s.chiave}>
                {visibili.length === 1 && segmenti.length > 0 && (
                  <path
                    d={`${percorso(segmenti[0])} L ${segmenti[0][segmenti[0].length - 1].x} ${T + altezzaTrama} L ${segmenti[0][0].x} ${T + altezzaTrama} Z`}
                    fill={`url(#${idGrad}-fade)`}
                  />
                )}
                {segmenti.map((seg, k) => (
                  <path
                    key={k}
                    d={percorso(seg)}
                    fill="none"
                    stroke={colore}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                ))}
                {s.punti.map((p, idx) => {
                  const v = modo === 'cumulato' ? p.cumulato : p.winrate
                  if (v === null || (modo === 'settimanale' && p.partite === 0)) return null
                  const r = modo === 'settimanale' ? Math.min(7, 2.6 + p.partite * 0.45) : 3.2
                  return (
                    <circle
                      key={p.settimana}
                      cx={x(idx)}
                      cy={y(v)}
                      r={sopra?.i === idx ? r + 1.6 : r}
                      fill="#101319"
                      stroke={colore}
                      strokeWidth="2"
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>

        {sopra && (
          <Tooltip
            settimana={settimane[sopra.i]}
            indice={sopra.i}
            totale={settimane.length}
            serie={visibili}
            tutte={serie}
            modo={modo}
          />
        )}
      </div>

      <Legenda serie={serie} nascoste={nascoste} onCommuta={onCommuta} />
    </div>
  )
}

function Tooltip({
  settimana,
  indice,
  totale,
  serie,
  tutte,
  modo,
}: {
  settimana: string
  indice: number
  totale: number
  serie: SerieSettimanale[]
  tutte: SerieSettimanale[]
  modo: ModoLinea
}) {
  // Oltre meta' grafico il riquadro si sposta a sinistra per non uscire.
  const aDestra = totale > 1 ? indice / (totale - 1) < 0.6 : true
  const righe = serie
    .map((s) => ({ s, p: s.punti[indice] }))
    .filter((r) => r.p && (modo === 'cumulato' ? r.p.cumulato !== null : r.p.partite > 0))

  return (
    <div
      className="pointer-events-none absolute top-2 z-20 max-w-72 rounded-lg border border-ink-700 bg-ink-950/95 px-2.5 py-2 text-xs shadow-xl"
      style={aDestra ? { left: '12%' } : { right: '4%' }}
    >
      <div className="font-semibold text-ink-100">
        Settimana del {dataBreve(settimana)} · S{settimanaIso(settimana)}
      </div>
      {righe.length === 0 ? (
        <div className="mt-1 text-ink-400">Nessuna partita.</div>
      ) : (
        <table className="mt-1">
          <tbody>
            {righe.map(({ s, p }) => (
              <tr key={s.chiave}>
                <td className="pr-2">
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: coloreSerie(tutte.indexOf(s)) }}
                  />
                  <span className="text-ink-300">{s.chiave}</span>
                </td>
                <td className="pr-2 text-right font-semibold text-ink-100">
                  {pct(modo === 'cumulato' ? p.cumulato : p.winrate, 0)}
                </td>
                <td className="text-right text-ink-400">
                  {p.vittorie}V/{p.partite - p.vittorie}S
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Legenda({
  serie,
  nascoste,
  onCommuta,
}: {
  serie: SerieSettimanale[]
  nascoste: Set<string>
  onCommuta: (chiave: string) => void
}) {
  if (serie.length <= 1) return null
  return (
    <div className="flex flex-wrap gap-1.5 border-t border-ink-700/70 px-3 py-2">
      {serie.map((s, i) => {
        const spenta = nascoste.has(s.chiave)
        return (
          <button
            key={s.chiave}
            type="button"
            onClick={() => onCommuta(s.chiave)}
            title="Clicca per mostrare o nascondere la serie"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              spenta
                ? 'border-ink-700 bg-ink-900 text-ink-400'
                : 'border-ink-600 bg-ink-850 text-ink-100'
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: spenta ? '#38404f' : coloreSerie(i) }}
            />
            {s.chiave}
            <span className="text-ink-400">{pct(s.totale.winrate, 0)}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Istogramma delle partite per settimana, diviso vinte/perse. Sta sotto la
 * linea del winrate perche' una percentuale senza volume inganna: 100% su una
 * partita e 70% su venti sono due cose diverse.
 */
export function GraficoVolume({
  serie,
  settimane,
  altezza = 90,
}: {
  serie: SerieSettimanale
  settimane: string[]
  altezza?: number
}) {
  const L = 44
  const R = 14
  const W = 900
  const H = altezza
  const T = 8
  const B = 16
  const larghezza = W - L - R
  const max = Math.max(1, ...serie.punti.map((p) => p.partite))
  // Stesso asse x del grafico a linee, cosi' barra e punto della settimana
  // stanno incolonnati.
  const passo = settimane.length > 1 ? larghezza / (settimane.length - 1) : 0
  const x = (i: number) => (settimane.length > 1 ? L + i * passo : L + larghezza / 2)
  const larghezzaBarra = Math.min(30, (passo || larghezza) * 0.5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: altezza }} role="img">
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#262c38" />
      <text x={L - 8} y={T + 10} textAnchor="end" fontSize="11" fill="#7c8798">
        {max}
      </text>
      {serie.punti.map((p, i) => {
        if (p.partite === 0) return null
        const h = ((H - B - T) * p.partite) / max
        const hv = (h * p.vittorie) / p.partite
        const cx = x(i) - larghezzaBarra / 2
        return (
          <g key={p.settimana}>
            <rect x={cx} y={H - B - h} width={larghezzaBarra} height={h - hv} fill="#f4626f" opacity="0.85" rx="2" />
            <rect x={cx} y={H - B - hv} width={larghezzaBarra} height={hv} fill="#3fbf7f" opacity="0.9" rx="2" />
            <text x={cx + larghezzaBarra / 2} y={H - B - h - 3} textAnchor="middle" fontSize="10" fill="#a6b0be">
              {p.partite}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Barre orizzontali del winrate per categoria, con la parte verde e quella
 * rossa proporzionali a vittorie e sconfitte.
 */
export function BarreWinrate({
  righe,
  onClick,
  attivo,
}: {
  righe: { chiave: string; partite: number; vittorie: number; winrate: number | null }[]
  onClick?: (chiave: string) => void
  attivo?: string[]
}) {
  const max = Math.max(1, ...righe.map((r) => r.partite))
  return (
    <div className="divide-y divide-ink-700/50">
      {righe.map((r) => {
        const selezionato = attivo?.includes(r.chiave)
        return (
          <div
            key={r.chiave}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={() => onClick?.(r.chiave)}
            onKeyDown={(e) => {
              if (onClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onClick(r.chiave)
              }
            }}
            title={onClick ? 'Clicca per filtrare su questo valore' : undefined}
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-1.5 ${
              onClick ? 'cursor-pointer hover:bg-ink-850' : ''
            } ${selezionato ? 'bg-sky-500/10' : ''}`}
          >
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm text-ink-100">{r.chiave}</span>
                <span className="shrink-0 text-[11px] text-ink-400">
                  {r.vittorie}V · {r.partite - r.vittorie}S
                </span>
              </div>
              {/* La barra e' larga in proporzione alle partite: un 100% su una
                  partita resta visibilmente piu' corto di un 60% su venti. */}
              <div className="mt-1 h-2 w-full rounded-full bg-ink-850">
                <div className="flex h-2 overflow-hidden rounded-full" style={{ width: `${(r.partite / max) * 100}%` }}>
                  <div className="bg-win" style={{ width: `${((r.winrate ?? 0) * 100).toFixed(1)}%` }} />
                  <div className="bg-loss" style={{ width: `${(100 - (r.winrate ?? 0) * 100).toFixed(1)}%` }} />
                </div>
              </div>
            </div>
            <div
              className={`w-14 text-right text-sm font-semibold ${
                r.winrate === null || r.partite < 3
                  ? 'text-ink-300'
                  : r.winrate >= 0.65
                    ? 'text-win'
                    : r.winrate >= 0.5
                      ? 'text-amber-300'
                      : r.winrate >= 0.35
                        ? 'text-orange-400'
                        : 'text-loss'
              }`}
            >
              {pct(r.winrate, 0)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Ciambella vittorie/sconfitte per il riepilogo. */
export function Ciambella({ vittorie, sconfitte }: { vittorie: number; sconfitte: number }) {
  const tot = vittorie + sconfitte
  const raggio = 42
  const circonferenza = 2 * Math.PI * raggio
  const quota = tot > 0 ? vittorie / tot : 0
  return (
    <svg viewBox="0 0 110 110" className="h-32 w-32" role="img">
      <circle cx="55" cy="55" r={raggio} fill="none" stroke="#f4626f" strokeWidth="14" opacity="0.85" />
      <circle
        cx="55"
        cy="55"
        r={raggio}
        fill="none"
        stroke="#3fbf7f"
        strokeWidth="14"
        strokeDasharray={`${circonferenza * quota} ${circonferenza}`}
        transform="rotate(-90 55 55)"
        strokeLinecap="butt"
      />
      <text x="55" y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill="#e7ebf1">
        {pct(tot > 0 ? quota : null, 0)}
      </text>
      <text x="55" y="68" textAnchor="middle" fontSize="11" fill="#7c8798">
        {vittorie}V · {sconfitte}S
      </text>
    </svg>
  )
}
