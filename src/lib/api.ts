import type { Liste, Match } from '../types'

/**
 * Cliente dell'API locale che usa il workbook Excel come database.
 *
 * Esiste solo quando la dashboard gira dal server locale (`npm start` o
 * `npm run dev`). Aperta da GitHub Pages, o senza Python, ogni chiamata
 * fallisce e la dashboard resta in modalita' browser: per questo qui non si
 * lancia mai un'eccezione per "server assente", si restituisce null.
 */

const BASE = 'api/excel'

export type StatoExcel = {
  disponibile: boolean
  file?: string
  match?: number
  bloccato?: boolean
  modificato?: string
  fogli?: string[]
  errore?: string
  motivo?: string
}

export type EsitoScrittura = {
  scritti: number
  rimosse: number
  formuleAggiunte: number
  backup: string
}

/** Il corpo di errore che l'API restituisce quando qualcosa non va. */
type Errore = { errore?: string; dettaglio?: string; motivo?: string }

function messaggio(corpo: Errore | null, ripiego: string): string {
  if (!corpo?.errore) return ripiego
  return corpo.dettaglio ? `${corpo.errore} (${corpo.dettaglio})` : corpo.errore
}

/**
 * Stato del workbook, o null se il server locale non c'e'.
 * Non lancia mai: "non c'e'" e' una risposta legittima, non un errore.
 */
export async function statoExcel(): Promise<StatoExcel | null> {
  try {
    const r = await fetch(`${BASE}/stato`, { headers: { Accept: 'application/json' } })
    if (!r.ok && r.status !== 409) return null
    const corpo = (await r.json()) as StatoExcel
    // Su GitHub Pages una rotta inesistente puo' restituire l'index.html con
    // stato 200: se non e' l'oggetto che ci aspettiamo, il server non c'e'.
    return typeof corpo?.disponibile === 'boolean' ? corpo : null
  } catch {
    return null
  }
}

export async function leggiDaExcel(): Promise<{ match: Match[]; liste: Liste }> {
  const r = await fetch(`${BASE}/registro`, { headers: { Accept: 'application/json' } })
  const corpo = await r.json().catch(() => null)
  if (!r.ok) throw new Error(messaggio(corpo, `Lettura fallita (${r.status}).`))
  return corpo as { match: Match[]; liste: Liste }
}

export async function scriviSuExcel(match: Match[]): Promise<EsitoScrittura> {
  const r = await fetch(`${BASE}/registro`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ match }),
  })
  const corpo = await r.json().catch(() => null)
  if (!r.ok) throw new Error(messaggio(corpo, `Scrittura fallita (${r.status}).`))
  return corpo as EsitoScrittura
}

/**
 * Chiave con cui si riconosce lo stesso match letto da due parti diverse.
 * Serve a capire se nel browser sono rimaste partite che nell'Excel non ci
 * sono: gli id non si possono confrontare, perche' l'Excel li rigenera dalla
 * posizione nel foglio.
 */
export function impronta(m: Match): string {
  // Separatore che non puo' comparire nei campi: unendo con la stringa vuota
  // due match diversi potrebbero produrre la stessa chiave.
  return [m.data, m.deck, m.avversario, m.risultato, m.turno ?? '', m.note].join('\u001f')
}
