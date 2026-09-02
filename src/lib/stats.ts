import type { Dimensione, Filtri, Match } from '../types'
import { normalizza, perNome, winrate } from './format'

// ---------------------------------------------------------------- settimane

/**
 * Lunedi' della settimana ISO che contiene la data, in ISO.
 * Le settimane sono l'unita' di tutti i grafici di andamento: raggruppare per
 * giorno darebbe punti da 2-3 partite, per mese un punto solo.
 */
export function lunediIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  // getUTCDay(): 0 = domenica, quindi la domenica arretra di 6 giorni.
  const scarto = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - scarto)
  return d.toISOString().slice(0, 10)
}

/** Numero di settimana ISO, per l'etichetta "S35". */
export function settimanaIso(iso: string): number {
  const d = new Date(`${lunediIso(iso)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return 0
  // Il giovedi' della settimana decide l'anno ISO a cui appartiene.
  d.setUTCDate(d.getUTCDate() + 3)
  const primoGennaio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.round((d.getTime() - primoGennaio.getTime()) / 604800000) + 1
}

/**
 * Tutti i lunedi' fra il primo e l'ultimo match, comprese le settimane vuote:
 * senza i buchi il grafico dell'andamento comprimerebbe le pause, facendo
 * sembrare consecutive due settimane lontane.
 */
export function settimaneComplete(match: Match[]): string[] {
  const date = match
    .map((m) => m.data)
    .filter(Boolean)
    .sort()
  if (date.length === 0) return []
  const fine = lunediIso(date[date.length - 1])
  const settimane: string[] = []
  let cur = lunediIso(date[0])
  // Limite di sicurezza: 520 settimane sono dieci anni di registro.
  for (let i = 0; cur <= fine && i < 520; i++) {
    settimane.push(cur)
    const d = new Date(`${cur}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 7)
    cur = d.toISOString().slice(0, 10)
  }
  return settimane
}

// ------------------------------------------------------------------ filtri

export const FILTRI_VUOTI: Filtri = {
  deck: [],
  avversario: [],
  formato: [],
  decklist: [],
  torneo: [],
  turno: [],
  tag: [],
  da: '',
  a: '',
  cerca: '',
  soloConNote: false,
}

export function filtriAttivi(f: Filtri): number {
  return (
    f.deck.length +
    f.avversario.length +
    f.formato.length +
    f.decklist.length +
    f.torneo.length +
    f.turno.length +
    f.tag.length +
    (f.da ? 1 : 0) +
    (f.a ? 1 : 0) +
    (f.cerca.trim() ? 1 : 0) +
    (f.soloConNote ? 1 : 0)
  )
}

/**
 * Applica i filtri. `escluse` salta alcune dimensioni: serve ai menu del
 * pannello filtri, dove le opzioni di un campo vanno contate ignorando il
 * campo stesso, altrimenti scegliere un deck farebbe sparire tutti gli altri.
 */
export function applicaFiltri(match: Match[], f: Filtri, escluse: Dimensione[] = []): Match[] {
  const usa = (d: Dimensione) => !escluse.includes(d)
  const testo = normalizza(f.cerca)

  return match.filter((m) => {
    if (usa('deck') && f.deck.length && !f.deck.includes(m.deck)) return false
    if (usa('avversario') && f.avversario.length && !f.avversario.includes(m.avversario)) return false
    if (usa('formato') && f.formato.length && !f.formato.includes(m.formato)) return false
    if (usa('decklist') && f.decklist.length && !f.decklist.includes(m.decklist)) return false
    if (usa('torneo') && f.torneo.length && !f.torneo.includes(m.torneo)) return false
    if (usa('turno') && f.turno.length && (m.turno === null || !f.turno.includes(m.turno))) return false
    if (usa('tag') && f.tag.length && !f.tag.some((t) => m.tag.includes(t))) return false
    if (f.da && m.data < f.da) return false
    if (f.a && m.data > f.a) return false
    if (f.soloConNote && !m.note.trim()) return false
    if (testo) {
      const campi = normalizza(
        [m.deck, m.avversario, m.decklist, m.formato, m.torneo, m.note, m.tag.join(' ')].join(' '),
      )
      if (!campi.includes(testo)) return false
    }
    return true
  })
}

// ------------------------------------------------------------- aggregazioni

export type Riepilogo = {
  partite: number
  vittorie: number
  sconfitte: number
  winrate: number | null
  primo: { partite: number; vittorie: number; winrate: number | null }
  secondo: { partite: number; vittorie: number; winrate: number | null }
  conNote: number
  /** Serie aperta, dal match piu' recente all'indietro. */
  streak: { tipo: 'W' | 'L'; lunghezza: number } | null
}

export function riepiloga(match: Match[]): Riepilogo {
  const vittorie = match.filter((m) => m.risultato === 'W').length
  const p1 = match.filter((m) => m.turno === 1)
  const p2 = match.filter((m) => m.turno === 2)
  const v1 = p1.filter((m) => m.risultato === 'W').length
  const v2 = p2.filter((m) => m.risultato === 'W').length

  const ordinati = [...match].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
  let streak: Riepilogo['streak'] = null
  if (ordinati.length) {
    const tipo = ordinati[0].risultato
    let n = 0
    while (n < ordinati.length && ordinati[n].risultato === tipo) n++
    streak = { tipo, lunghezza: n }
  }

  return {
    partite: match.length,
    vittorie,
    sconfitte: match.length - vittorie,
    winrate: winrate(vittorie, match.length),
    primo: { partite: p1.length, vittorie: v1, winrate: winrate(v1, p1.length) },
    secondo: { partite: p2.length, vittorie: v2, winrate: winrate(v2, p2.length) },
    conNote: match.filter((m) => m.note.trim()).length,
    streak,
  }
}

export type NotaGruppo = {
  data: string
  testo: string
  risultato: 'W' | 'L'
  contro: string
  deck: string
}

export type Gruppo = {
  chiave: string
  partite: number
  vittorie: number
  sconfitte: number
  winrate: number | null
  /** Note scritte nei match del gruppo, dalla piu' recente. */
  note: NotaGruppo[]
}

export const ETICHETTA_TURNO: Record<1 | 2, string> = {
  1: '1° (inizia)',
  2: '2° (risponde)',
}

/** I valori che una dimensione assume in un match (i tag ne danno piu' d'uno). */
export function valoriDi(m: Match, dim: Dimensione): string[] {
  switch (dim) {
    case 'turno':
      return m.turno === null ? [] : [ETICHETTA_TURNO[m.turno]]
    case 'tag':
      return m.tag.length ? m.tag : ['(nessun tag)']
    default:
      return m[dim] ? [m[dim]] : ['(non indicato)']
  }
}

/** Raggruppa per dimensione, ordinato per partite decrescenti. */
export function raggruppa(match: Match[], dim: Dimensione): Gruppo[] {
  const mappa = new Map<string, Gruppo>()
  for (const m of match) {
    for (const v of valoriDi(m, dim)) {
      let g = mappa.get(v)
      if (!g) {
        g = { chiave: v, partite: 0, vittorie: 0, sconfitte: 0, winrate: null, note: [] }
        mappa.set(v, g)
      }
      g.partite++
      if (m.risultato === 'W') g.vittorie++
      else g.sconfitte++
      if (m.note.trim()) {
        g.note.push({
          data: m.data,
          testo: m.note.trim(),
          risultato: m.risultato,
          contro: m.avversario,
          deck: m.deck,
        })
      }
    }
  }
  const gruppi = [...mappa.values()]
  for (const g of gruppi) {
    g.winrate = winrate(g.vittorie, g.partite)
    g.note.sort((a, b) => (a.data < b.data ? 1 : -1))
  }
  return gruppi.sort((a, b) => b.partite - a.partite || perNome(a.chiave, b.chiave))
}

// --------------------------------------------------------------- andamento

export type PuntoSettimana = {
  settimana: string
  partite: number
  vittorie: number
  winrate: number | null
  /** Winrate dall'inizio del periodo fino a questa settimana inclusa. */
  cumulato: number | null
}

export type SerieSettimanale = {
  chiave: string
  totale: { partite: number; vittorie: number; winrate: number | null }
  punti: PuntoSettimana[]
}

/**
 * Andamento settimanale del winrate, una serie per valore della dimensione
 * (o una sola serie complessiva quando `dim` e' null).
 *
 * `settimane` e' l'asse comune calcolato su tutto il campione filtrato, cosi'
 * le serie restano allineate anche quando un deck salta una settimana.
 */
export function andamentoSettimanale(
  match: Match[],
  dim: Dimensione | null,
  settimane: string[],
): SerieSettimanale[] {
  const perChiave = new Map<string, Match[]>()
  for (const m of match) {
    const chiavi = dim === null ? ['Tutti i match'] : valoriDi(m, dim)
    for (const k of chiavi) {
      const arr = perChiave.get(k)
      if (arr) arr.push(m)
      else perChiave.set(k, [m])
    }
  }

  const serie: SerieSettimanale[] = []
  for (const [chiave, suoi] of perChiave) {
    const perSettimana = new Map<string, Match[]>()
    for (const m of suoi) {
      const s = lunediIso(m.data)
      const arr = perSettimana.get(s)
      if (arr) arr.push(m)
      else perSettimana.set(s, [m])
    }

    let cumPartite = 0
    let cumVittorie = 0
    const punti = settimane.map((s) => {
      const dentro = perSettimana.get(s) ?? []
      const vittorie = dentro.filter((m) => m.risultato === 'W').length
      cumPartite += dentro.length
      cumVittorie += vittorie
      return {
        settimana: s,
        partite: dentro.length,
        vittorie,
        winrate: winrate(vittorie, dentro.length),
        cumulato: winrate(cumVittorie, cumPartite),
      }
    })

    serie.push({
      chiave,
      totale: {
        partite: cumPartite,
        vittorie: cumVittorie,
        winrate: winrate(cumVittorie, cumPartite),
      },
      punti,
    })
  }

  return serie.sort((a, b) => b.totale.partite - a.totale.partite || perNome(a.chiave, b.chiave))
}

// ----------------------------------------------------------------- matchup

export type Cella = {
  partite: number
  vittorie: number
  winrate: number | null
  note: number
}

export type Matrice = {
  righe: string[]
  colonne: string[]
  celle: Map<string, Cella>
  totaliRiga: Map<string, Cella>
  totaliColonna: Map<string, Cella>
}

// Separatore che non puo' comparire in un nome di deck.
// Separatore che non puo' comparire in un nome di deck: con un semplice
// spazio due coppie diverse potrebbero collidere sulla stessa chiave.
const SEP = '\u001f'
const chiaveCella = (riga: string, colonna: string) => `${riga}${SEP}${colonna}`

/** Incrocio fra due dimensioni: di norma avversario (righe) x deck (colonne). */
export function matrice(match: Match[], dimRiga: Dimensione, dimColonna: Dimensione): Matrice {
  const celle = new Map<string, Cella>()
  const totaliRiga = new Map<string, Cella>()
  const totaliColonna = new Map<string, Cella>()
  const righe = new Set<string>()
  const colonne = new Set<string>()

  const somma = (mappa: Map<string, Cella>, k: string, vinta: boolean, haNota: boolean) => {
    let c = mappa.get(k)
    if (!c) {
      c = { partite: 0, vittorie: 0, winrate: null, note: 0 }
      mappa.set(k, c)
    }
    c.partite++
    if (vinta) c.vittorie++
    if (haNota) c.note++
    c.winrate = winrate(c.vittorie, c.partite)
  }

  for (const m of match) {
    const vinta = m.risultato === 'W'
    const haNota = Boolean(m.note.trim())
    for (const r of valoriDi(m, dimRiga)) {
      righe.add(r)
      somma(totaliRiga, r, vinta, haNota)
      for (const c of valoriDi(m, dimColonna)) {
        colonne.add(c)
        somma(celle, chiaveCella(r, c), vinta, haNota)
        somma(totaliColonna, c, vinta, haNota)
      }
    }
  }

  const ordina = (insieme: Set<string>, totali: Map<string, Cella>) =>
    [...insieme].sort(
      (a, b) => (totali.get(b)?.partite ?? 0) - (totali.get(a)?.partite ?? 0) || perNome(a, b),
    )

  return {
    righe: ordina(righe, totaliRiga),
    colonne: ordina(colonne, totaliColonna),
    celle,
    totaliRiga,
    totaliColonna,
  }
}

export function cella(m: Matrice, riga: string, colonna: string): Cella | undefined {
  return m.celle.get(chiaveCella(riga, colonna))
}
