import { create } from 'zustand'
import seed from '../data/seed.json'
import { normalizza, perNome } from '../lib/format'
import { storageDisponibile } from '../lib/storage'
import type { Liste, Match, Seed, Turno } from '../types'

const CHIAVE = 'tcgdash:registro:v1'
const SEED = seed as unknown as Seed

export type Registro = {
  match: Match[]
  /** Valori aggiunti a mano che non compaiono (ancora) in nessun match. */
  extra: Partial<Liste>
}

export type StatoRegistro = Registro & {
  /** false quando il browser blocca localStorage: si avvisa in testa alla pagina. */
  salvataggioAttivo: boolean
  aggiungi: (m: Omit<Match, 'id'>) => void
  modifica: (id: string, m: Omit<Match, 'id'>) => void
  elimina: (id: string) => void
  duplica: (id: string) => void
  aggiungiValore: (campo: keyof Liste, valore: string) => void
  /** Sostituisce tutto il registro (import da file). */
  sostituisci: (r: Registro) => void
  /** Torna al registro generato dall'Excel, perdendo le modifiche locali. */
  ripristinaSeed: () => void
}

function nuovoId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Ripulisce un match letto da JSON: il file potrebbe venire da una versione vecchia. */
function sanifica(m: Partial<Match> & Record<string, unknown>, i: number): Match | null {
  const risultato = String(m.risultato ?? '').toUpperCase()
  if (risultato !== 'W' && risultato !== 'L') return null
  const turno = Number(m.turno)
  const testo = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    id: testo(m.id) || `imp-${i}`,
    data: testo(m.data),
    formato: testo(m.formato),
    deck: testo(m.deck),
    decklist: testo(m.decklist),
    avversario: testo(m.avversario),
    turno: turno === 1 || turno === 2 ? (turno as Turno) : null,
    risultato,
    tag: Array.isArray(m.tag) ? m.tag.map((t) => String(t).trim()).filter(Boolean) : [],
    torneo: testo(m.torneo),
    note: typeof m.note === 'string' ? m.note.trim() : '',
  }
}

export function leggiRegistro(testo: string): Registro {
  const dati = JSON.parse(testo) as { match?: unknown[]; extra?: Partial<Liste> }
  if (!Array.isArray(dati.match)) throw new Error('File non valido: manca l’elenco "match".')
  const match = dati.match
    .map((m, i) => sanifica(m as Partial<Match>, i))
    .filter((m): m is Match => m !== null)
  if (match.length === 0) throw new Error('Il file non contiene nessun match valido.')
  return { match, extra: dati.extra ?? {} }
}

/** Dal piu' recente: e' l'ordine del registro e la fonte dei valori precompilati nel form. */
function perDataDecrescente(match: Match[]): Match[] {
  return [...match].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
}

function dalSeed(): Registro {
  return {
    match: perDataDecrescente(
      SEED.match.map((m, i) => sanifica(m, i)).filter((m): m is Match => m !== null),
    ),
    extra: {},
  }
}

function registroIniziale(): Registro {
  if (storageDisponibile()) {
    const salvato = localStorage.getItem(CHIAVE)
    if (salvato) {
      try {
        const r = leggiRegistro(salvato)
        return { ...r, match: perDataDecrescente(r.match) }
      } catch {
        // Dato corrotto: meglio ripartire dal seed che lasciare la pagina bianca.
        localStorage.removeItem(CHIAVE)
      }
    }
  }
  return dalSeed()
}

function salva(r: Registro): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(r))
  } catch {
    // Quota piena o storage negato: l'avviso in testa alla pagina lo dice gia'.
  }
}

export const useRegistro = create<StatoRegistro>((set, get) => {
  const scrivi = (aggiorna: (r: Registro) => Registro) => {
    const aggiornato = aggiorna({ match: get().match, extra: get().extra })
    const prossimo = { ...aggiornato, match: perDataDecrescente(aggiornato.match) }
    salva(prossimo)
    set(prossimo)
  }

  return {
    ...registroIniziale(),
    salvataggioAttivo: storageDisponibile(),

    aggiungi: (m) => scrivi((r) => ({ ...r, match: [{ ...m, id: nuovoId() }, ...r.match] })),

    modifica: (id, m) =>
      scrivi((r) => ({ ...r, match: r.match.map((x) => (x.id === id ? { ...m, id } : x)) })),

    elimina: (id) => scrivi((r) => ({ ...r, match: r.match.filter((x) => x.id !== id) })),

    duplica: (id) =>
      scrivi((r) => {
        const orig = r.match.find((x) => x.id === id)
        if (!orig) return r
        return { ...r, match: [{ ...orig, id: nuovoId() }, ...r.match] }
      }),

    aggiungiValore: (campo, valore) =>
      scrivi((r) => {
        const v = valore.trim()
        if (!v) return r
        const gia = [...(r.extra[campo] ?? []), ...elencoDa(r.match, campo)]
        if (gia.some((x) => normalizza(x) === normalizza(v))) return r
        return { ...r, extra: { ...r.extra, [campo]: [...(r.extra[campo] ?? []), v] } }
      }),

    sostituisci: (r) => scrivi(() => r),

    ripristinaSeed: () => {
      try {
        localStorage.removeItem(CHIAVE)
      } catch {
        // Niente storage: si riparte comunque dal seed in memoria.
      }
      const r = dalSeed()
      salva(r)
      set(r)
    },
  }
})

/** Valori distinti di un campo, come compaiono nei match. */
function elencoDa(match: Match[], campo: keyof Liste): string[] {
  if (campo === 'tag') return [...new Set(match.flatMap((m) => m.tag))]
  return [...new Set(match.map((m) => m[campo]).filter(Boolean))]
}

/**
 * Elenchi per i menu del form: valori del seed + valori dei match inseriti +
 * valori aggiunti a mano, senza doppioni e in ordine alfabetico.
 */
export function liste(match: Match[], extra: Partial<Liste>): Liste {
  const campi: (keyof Liste)[] = ['deck', 'decklist', 'formato', 'avversario', 'torneo', 'tag']
  const fuori = {} as Liste
  for (const campo of campi) {
    const visti = new Map<string, string>()
    for (const v of [...(SEED.liste[campo] ?? []), ...elencoDa(match, campo), ...(extra[campo] ?? [])]) {
      const k = normalizza(v)
      if (k && !visti.has(k)) visti.set(k, v)
    }
    fuori[campo] = [...visti.values()].sort(perNome)
  }
  return fuori
}

export const infoSeed = { file: SEED.generatoDa, il: SEED.generatoIl, match: SEED.match.length }
