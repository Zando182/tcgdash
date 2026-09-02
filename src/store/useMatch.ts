import { create } from 'zustand'
import seed from '../data/seed.json'
import { impronta, leggiDaExcel, scriviSuExcel, statoExcel, type StatoExcel } from '../lib/api'
import { normalizza, oggiIso, perNome } from '../lib/format'
import { storageDisponibile } from '../lib/storage'
import type { Lista, Liste, Match, Seed, Turno } from '../types'

const CHIAVE = 'tcgdash:registro:v1'
const SEED = seed as unknown as Seed

/**
 * Dove vivono i match.
 *
 * `excel`   — il workbook data/TCG_Match.xlsx e' il database: si legge da li'
 *             all'avvio e ogni modifica ci viene riscritta dal server locale.
 * `browser` — nessun server (dashboard pubblicata, o Python assente): i match
 *             stanno in localStorage, come prima.
 */
export type Modo = 'excel' | 'browser'

export type Registro = {
  match: Match[]
  /** Le liste salvate, testo grezzo incollato dalla pagina Liste. */
  decklist: Lista[]
  /** Valori aggiunti a mano che non compaiono (ancora) in nessun match. */
  extra: Partial<Liste>
}

export type StatoRegistro = Registro & {
  modo: Modo
  excel: StatoExcel | null
  /** true mentre si legge il workbook all'avvio. */
  caricamento: boolean
  /** false quando il browser blocca localStorage: si avvisa in testa alla pagina. */
  salvataggioAttivo: boolean
  /** Popolato quando una scrittura sull'Excel fallisce: il match resta nel browser. */
  erroreExcel: string | null
  ultimoSalvataggio: string | null
  /** Match presenti solo nel browser e non nel workbook, da recuperare a mano. */
  soloNelBrowser: Match[]

  inizializza: () => Promise<void>
  ricaricaDaExcel: () => Promise<void>
  /** Riprova la scrittura fallita, senza toccare il registro. */
  riprovaSalvataggio: () => Promise<void>
  /** Manda nel workbook i match rimasti solo nel browser. */
  recuperaSoloNelBrowser: () => Promise<void>

  aggiungi: (m: Omit<Match, 'id'>) => void
  modifica: (id: string, m: Omit<Match, 'id'>) => void
  elimina: (id: string) => void
  duplica: (id: string) => void
  aggiungiValore: (campo: keyof Liste, valore: string) => void
  sostituisci: (r: Registro) => void
  ripristinaSeed: () => void

  /** Salva una lista nuova, o ne aggiorna una esistente se l'id combacia. */
  salvaLista: (lista: Omit<Lista, 'id' | 'aggiornata'> & { id?: string }) => void
  eliminaLista: (id: string) => void
}

function nuovoId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nuovoIdLista(): string {
  return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
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

/** Ripulisce una lista letta da JSON o dall'Excel, senza toccarne il testo. */
function sanificaLista(l: Partial<Lista> & Record<string, unknown>, i: number): Lista | null {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const nome = str(l.nome)
  // Il testo si tiene com'e': e' il punto della pagina Liste.
  const corpo = typeof l.testo === 'string' ? l.testo.replace(/\r\n/g, '\n') : ''
  if (!nome && !corpo.trim()) return null
  return {
    id: str(l.id) || `lista-${i}`,
    nome,
    mazzo: str(l.mazzo),
    aggiornata: str(l.aggiornata),
    testo: corpo,
  }
}

export function leggiRegistro(testo: string): Registro {
  const dati = JSON.parse(testo) as {
    match?: unknown[]
    decklist?: unknown[]
    extra?: Partial<Liste>
  }
  if (!Array.isArray(dati.match)) throw new Error('File non valido: manca l’elenco "match".')
  const match = dati.match
    .map((m, i) => sanifica(m as Partial<Match>, i))
    .filter((m): m is Match => m !== null)
  if (match.length === 0) throw new Error('Il file non contiene nessun match valido.')
  const decklist = Array.isArray(dati.decklist)
    ? dati.decklist
        .map((l, i) => sanificaLista(l as Partial<Lista>, i))
        .filter((l): l is Lista => l !== null)
    : []
  return { match, decklist, extra: dati.extra ?? {} }
}

/**
 * I match del primo elenco che non hanno una controparte nel secondo.
 *
 * Conta le occorrenze invece di usare un insieme di impronte: due partite dello
 * stesso giorno, stesso matchup, stesso esito e senza note hanno la stessa
 * impronta pur essendo due partite diverse, e con un insieme la seconda
 * sparirebbe.
 */
function nonPresentiIn(elenco: Match[], riferimento: Match[]): Match[] {
  const capienza = new Map<string, number>()
  for (const m of riferimento) {
    const k = impronta(m)
    capienza.set(k, (capienza.get(k) ?? 0) + 1)
  }
  return elenco.filter((m) => {
    const k = impronta(m)
    const n = capienza.get(k) ?? 0
    if (n > 0) {
      capienza.set(k, n - 1)
      return false
    }
    return true
  })
}

/** Dal piu' recente: e' l'ordine del registro e la fonte dei valori precompilati nel form. */
function perDataDecrescente(match: Match[]): Match[] {
  return [...match].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
}

/**
 * L'ordine in cui il registro viene mandato al workbook: dal piu' vecchio, che
 * e' l'ordine delle righe del foglio.
 *
 * E' un ordinamento stabile sulla sola data, non un `reverse()` di quello
 * mostrato a schermo: rovesciare l'elenco ribalterebbe anche le partite dello
 * stesso giorno, invertendone l'ordine nel foglio a ogni salvataggio.
 */
function perFoglio(match: Match[]): Match[] {
  return [...match].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
}

function dalSeed(): Registro {
  return {
    match: perDataDecrescente(
      SEED.match.map((m, i) => sanifica(m, i)).filter((m): m is Match => m !== null),
    ),
    decklist: (SEED.decklist ?? [])
      .map((l, i) => sanificaLista(l, i))
      .filter((l): l is Lista => l !== null),
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

function salvaLocale(r: Registro): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(r))
  } catch {
    // Quota piena o storage negato: l'avviso in testa alla pagina lo dice gia'.
  }
}

export const useRegistro = create<StatoRegistro>((set, get) => {
  // Una scrittura per volta: se ne arrivano altre mentre la prima e' in corso
  // (si inseriscono due match di fila), si manda solo l'ultimo registro, che
  // le contiene tutte.
  let inVolo = false
  let inCoda: { match: Match[]; decklist: Lista[] } | null = null

  async function versoExcel(match: Match[], decklist: Lista[]): Promise<void> {
    if (get().modo !== 'excel') return
    if (inVolo) {
      inCoda = { match, decklist }
      return
    }
    inVolo = true
    try {
      const esito = await scriviSuExcel(perFoglio(match), decklist)
      set({
        erroreExcel: null,
        ultimoSalvataggio: new Date().toISOString(),
        excel: { ...(get().excel ?? { disponibile: true }), match: esito.scritti, bloccato: false },
      })
    } catch (e) {
      set({ erroreExcel: e instanceof Error ? e.message : String(e) })
    } finally {
      inVolo = false
      const prossimo = inCoda
      inCoda = null
      if (prossimo) await versoExcel(prossimo.match, prossimo.decklist)
    }
  }

  /** Aggiorna il registro, lo specchia in localStorage e lo manda all'Excel. */
  const scrivi = (aggiorna: (r: Registro) => Registro) => {
    const aggiornato = aggiorna({
      match: get().match,
      decklist: get().decklist,
      extra: get().extra,
    })
    const prossimo = { ...aggiornato, match: perDataDecrescente(aggiornato.match) }
    // localStorage resta come copia anche in modalita' Excel: se la scrittura
    // sul workbook fallisce (file aperto in Excel), niente e' perso.
    salvaLocale(prossimo)
    set(prossimo)
    void versoExcel(prossimo.match, prossimo.decklist)
  }

  return {
    ...registroIniziale(),
    modo: 'browser',
    excel: null,
    caricamento: true,
    salvataggioAttivo: storageDisponibile(),
    erroreExcel: null,
    ultimoSalvataggio: null,
    soloNelBrowser: [],

    inizializza: async () => {
      const stato = await statoExcel()
      if (!stato?.disponibile) {
        set({ modo: 'browser', excel: stato, caricamento: false })
        return
      }
      try {
        const dal = await leggiDaExcel()
        const match = perDataDecrescente(
          dal.match.map((m, i) => sanifica(m, i)).filter((m): m is Match => m !== null),
        )
        // Il workbook comanda, ma se nel browser erano rimaste partite che li'
        // non ci sono (inserite senza server, o con l'Excel aperto) non si
        // buttano via in silenzio: si segnalano e si recuperano con un clic.
        //
        // L'elenco si accumula invece di essere ricalcolato da zero: questa
        // funzione gira piu' volte (React in sviluppo la richiama, e la
        // richiama il pulsante "Rileggi dal workbook"), e dal secondo giro il
        // registro in memoria e' gia' quello del foglio — ricalcolando si
        // perderebbe proprio l'elenco che serve a non perdere le partite.
        const soloNelBrowser = nonPresentiIn([...get().soloNelBrowser, ...get().match], match)
        const decklist = dal.decklist
          .map((l, i) => sanificaLista(l, i))
          .filter((l): l is Lista => l !== null)
        const registro = { match, decklist, extra: get().extra }
        salvaLocale(registro)
        set({ ...registro, modo: 'excel', excel: stato, caricamento: false, soloNelBrowser })
      } catch (e) {
        set({
          modo: 'browser',
          excel: { ...stato, disponibile: false, errore: e instanceof Error ? e.message : String(e) },
          caricamento: false,
        })
      }
    },

    ricaricaDaExcel: async () => {
      set({ caricamento: true })
      await get().inizializza()
    },

    riprovaSalvataggio: async () => {
      set({ erroreExcel: null })
      await versoExcel(get().match, get().decklist)
    },

    recuperaSoloNelBrowser: async () => {
      const { soloNelBrowser, match } = get()
      if (soloNelBrowser.length === 0) return
      const daAggiungere = nonPresentiIn(soloNelBrowser, match)
      set({ soloNelBrowser: [] })
      if (daAggiungere.length === 0) return
      const prossimo = {
        match: perDataDecrescente([...daAggiungere, ...match]),
        decklist: get().decklist,
        extra: get().extra,
      }
      salvaLocale(prossimo)
      set(prossimo)
      await versoExcel(prossimo.match, prossimo.decklist)
    },

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
      scrivi(() => dalSeed())
    },

    salvaLista: (lista) =>
      scrivi((r) => {
        const nome = lista.nome.trim()
        // Il testo NON si tocca: nessun trim, nessuna normalizzazione oltre ai
        // ritorni a capo. E' quello che l'utente ha incollato.
        const testo = lista.testo.replace(/\r\n/g, '\n')
        if (!nome && !testo.trim()) return r
        const aggiornata = oggiIso()
        const esistente = lista.id ? r.decklist.find((l) => l.id === lista.id) : undefined
        const nuova: Lista = {
          id: esistente?.id ?? nuovoIdLista(),
          nome,
          mazzo: lista.mazzo.trim(),
          aggiornata,
          testo,
        }
        return {
          ...r,
          decklist: esistente
            ? r.decklist.map((l) => (l.id === esistente.id ? nuova : l))
            : [nuova, ...r.decklist],
        }
      }),

    eliminaLista: (id) => scrivi((r) => ({ ...r, decklist: r.decklist.filter((l) => l.id !== id) })),
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
