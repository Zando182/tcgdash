import { useMemo, useState } from 'react'
import { perNome } from '../lib/format'
import { applicaFiltri, filtriAttivi } from '../lib/stats'
import { useFiltri } from '../store/useFiltri'
import type { Dimensione, Match } from '../types'
import { MultiSelect } from './ui'

type CampoMulti = 'deck' | 'avversario' | 'formato' | 'decklist' | 'torneo' | 'tag'

const CAMPI: { campo: CampoMulti; etichetta: string }[] = [
  { campo: 'deck', etichetta: 'Mazzo' },
  { campo: 'avversario', etichetta: 'Mazzo avversario' },
  { campo: 'formato', etichetta: 'Espansione' },
  { campo: 'decklist', etichetta: 'Lista' },
  { campo: 'torneo', etichetta: 'Torneo' },
  { campo: 'tag', etichetta: 'Tag' },
]

/**
 * Barra dei filtri condivisa da tutte le dashboard.
 *
 * I conteggi accanto a ogni voce sono calcolati escludendo il filtro del campo
 * stesso: cosi' scegliendo un mazzo si continua a vedere quante partite
 * darebbero gli altri mazzi, invece di trovarli tutti a zero.
 */
export function BarraFiltri({ match }: { match: Match[] }) {
  const { filtri, imposta, commuta, commutaTurno, azzera } = useFiltri()
  const [espansa, setEspansa] = useState(false)
  const attivi = filtriAttivi(filtri)

  const opzioni = useMemo(() => {
    const fuori = {} as Record<CampoMulti, { valore: string; conteggio: number }[]>
    for (const { campo } of CAMPI) {
      const base = applicaFiltri(match, filtri, [campo as Dimensione])
      const conta = new Map<string, number>()
      for (const m of base) {
        const valori = campo === 'tag' ? m.tag : [m[campo]]
        for (const v of valori) if (v) conta.set(v, (conta.get(v) ?? 0) + 1)
      }
      // Anche i valori scelti restano in elenco pur essendo a zero, altrimenti
      // non si potrebbe togliere un filtro che ha svuotato il campione.
      for (const v of filtri[campo]) if (!conta.has(v)) conta.set(v, 0)
      fuori[campo] = [...conta.entries()]
        .map(([valore, conteggio]) => ({ valore, conteggio }))
        .sort((a, b) => b.conteggio - a.conteggio || perNome(a.valore, b.valore))
    }
    return fuori
  }, [match, filtri])

  return (
    <div className="card p-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {CAMPI.slice(0, espansa ? CAMPI.length : 3).map(({ campo, etichetta }) => (
          <MultiSelect
            key={campo}
            etichetta={etichetta}
            opzioni={opzioni[campo]}
            scelti={filtri[campo]}
            onCommuta={(v) => commuta(campo, v)}
            onAzzera={() => imposta(campo, [])}
          />
        ))}

        <input
          className="field col-span-2 sm:col-span-1"
          placeholder="Cerca in note, mazzi, tag..."
          value={filtri.cerca}
          onChange={(e) => imposta('cerca', e.target.value)}
        />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={espansa ? 'chip-on' : 'chip'}
            onClick={() => setEspansa((v) => !v)}
          >
            {espansa ? '− meno filtri' : '+ altri filtri'}
          </button>
          {attivi > 0 && (
            <button type="button" className="chip-on" onClick={azzera} title="Rimuove tutti i filtri">
              Azzera ({attivi})
            </button>
          )}
        </div>
      </div>

      {espansa && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-700/70 pt-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] tracking-wide text-ink-400 uppercase">Turno</span>
            {([1, 2] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={filtri.turno.includes(t) ? 'chip-on' : 'chip'}
                onClick={() => commutaTurno(t)}
              >
                {t === 1 ? '1° (inizia)' : '2° (risponde)'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] tracking-wide text-ink-400 uppercase">Dal</span>
            <input
              type="date"
              className="field py-1 text-xs"
              value={filtri.da}
              onChange={(e) => imposta('da', e.target.value)}
            />
            <span className="text-[11px] tracking-wide text-ink-400 uppercase">al</span>
            <input
              type="date"
              className="field py-1 text-xs"
              value={filtri.a}
              onChange={(e) => imposta('a', e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-300">
            <input
              type="checkbox"
              className="accent-sky-500"
              checked={filtri.soloConNote}
              onChange={(e) => imposta('soloConNote', e.target.checked)}
            />
            Solo match con note
          </label>
        </div>
      )}

      {attivi > 0 && <RiepilogoFiltri />}
    </div>
  )
}

/** Elenco compatto dei filtri attivi, ognuno togliibile con un clic. */
function RiepilogoFiltri() {
  const { filtri, commuta, commutaTurno, imposta } = useFiltri()
  const pezzi: { testo: string; togli: () => void }[] = []

  for (const { campo, etichetta } of CAMPI) {
    for (const v of filtri[campo]) {
      pezzi.push({ testo: `${etichetta}: ${v}`, togli: () => commuta(campo, v) })
    }
  }
  for (const t of filtri.turno) {
    pezzi.push({ testo: `Turno: ${t}°`, togli: () => commutaTurno(t) })
  }
  if (filtri.da) pezzi.push({ testo: `Dal ${filtri.da}`, togli: () => imposta('da', '') })
  if (filtri.a) pezzi.push({ testo: `Al ${filtri.a}`, togli: () => imposta('a', '') })
  if (filtri.cerca.trim()) {
    pezzi.push({ testo: `Cerca: "${filtri.cerca}"`, togli: () => imposta('cerca', '') })
  }
  if (filtri.soloConNote) {
    pezzi.push({ testo: 'Solo con note', togli: () => imposta('soloConNote', false) })
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-700/70 pt-2">
      {pezzi.map((p) => (
        <button key={p.testo} type="button" className="chip-on" onClick={p.togli} title="Togli questo filtro">
          {p.testo} <span className="text-sky-300/70">×</span>
        </button>
      ))}
    </div>
  )
}
