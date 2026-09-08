/**
 * Metagame: dati pubblici dei tornei online della piattaforma Limitless.
 *
 * Il server locale scarica e tiene una copia su disco; qui si legge quella
 * copia e si calcolano share e matchup. Nessun numero arriva gia' pronto
 * dall'esterno: dall'API vengono i fatti (chi giocava cosa, chi ha battuto
 * chi), le percentuali si fanno qui.
 *
 * Ogni torneo sa se si e' giocato online o dal vivo, quindi si possono
 * guardare separatamente.
 */

const BASE = 'api/metagame'

/**
 * Nome che lo scaricatore da' a chi non ha una lista registrata. Non e' un
 * archetipo: nei tornei dal vivo capita che le liste non si consegnino, e
 * lasciarlo negli elenchi lo farebbe comparire in testa come se fosse il mazzo
 * piu' giocato.
 */
export const ARCHETIPO_IGNOTO = 'Sconosciuto'

/** Esito di una partita, come lo registra lo scaricatore. */
export const PAREGGIO = 0
export const VINCE_A = 1
export const VINCE_B = 2

export type Torneo = {
  id: string
  nome: string
  /** ISO, solo la data. */
  data: string
  giocatori: number
  formato: string
  /** true online, false dal vivo, null se i dettagli non sono ancora arrivati. */
  online: boolean | null
  piattaforma: string
  organizzatore: string
  /** Indice archetipo (come stringa) -> quanti giocatori l'hanno portato. */
  conteggi: Record<string, number>
}

/** [indice torneo, archetipo A, archetipo B, esito] */
export type PartitaMeta = [number, number, number, number]

export type DatiMetagame = {
  aggiornato: string
  archetipi: string[]
  tornei: Torneo[]
  partite: PartitaMeta[]
}

export type StatoMetagame = {
  aggiornato: string
  tornei: number
  partite: number
  archetipi: number
  dal: string
  al: string
  formati: string[]
  online: number
  dalVivo: number
  senzaDettagli: number
  errore?: string
}

export type EsitoAggiornamento = {
  scaricati: number
  /** Tornei gia' in copia a cui mancava il dato online/dal vivo. */
  completati: number
  /** Tornei tolti perche' di un formato che non si segue piu' (il GLC). */
  scartati: number
  restano: number
  fermatoDalLimite: boolean
  creditoResiduo: number
  tornei: number
  partite: number
  archetipi: number
  aggiornato: string
}

const vuoti: DatiMetagame = { aggiornato: '', archetipi: [], tornei: [], partite: [] }

function messaggio(corpo: { errore?: string; dettaglio?: string } | null, ripiego: string) {
  if (!corpo?.errore) return ripiego
  return corpo.dettaglio ? `${corpo.errore} (${corpo.dettaglio})` : corpo.errore
}

/** null quando il server locale non c'e' (dashboard pubblicata, o senza Python). */
export async function statoMetagame(): Promise<StatoMetagame | null> {
  try {
    const r = await fetch(`${BASE}/stato`, { headers: { Accept: 'application/json' } })
    if (!r.ok && r.status !== 409) return null
    const corpo = (await r.json()) as StatoMetagame
    return typeof corpo?.tornei === 'number' ? corpo : null
  } catch {
    return null
  }
}

export async function datiMetagame(): Promise<DatiMetagame> {
  try {
    const r = await fetch(`${BASE}/dati`, { headers: { Accept: 'application/json' } })
    if (!r.ok) return vuoti
    const corpo = (await r.json()) as DatiMetagame
    return Array.isArray(corpo?.archetipi) ? corpo : vuoti
  } catch {
    return vuoti
  }
}

export async function aggiornaMetagame(): Promise<EsitoAggiornamento> {
  const r = await fetch(`${BASE}/aggiorna`, { method: 'POST' })
  const corpo = await r.json().catch(() => null)
  if (!r.ok) throw new Error(messaggio(corpo, `Aggiornamento fallito (${r.status}).`))
  return corpo as EsitoAggiornamento
}

// ------------------------------------------------------------- aggregazioni

/** Dove si e' giocato: tutti, solo online, solo dal vivo. */
export type DoveGiocato = 'tutti' | 'online' | 'dalvivo'

export type FiltriMeta = {
  formato: string
  dove: DoveGiocato
  dal: string
  al: string
  /** Esclude i tornei piccoli, dove i matchup sono rumore. */
  giocatoriMinimi: number
}

export const FILTRI_META_VUOTI: FiltriMeta = {
  formato: '',
  dove: 'tutti',
  dal: '',
  al: '',
  giocatoriMinimi: 0,
}

/** Indici dei tornei che passano i filtri. */
export function torneiFiltrati(dati: DatiMetagame, f: FiltriMeta): Set<number> {
  const dentro = new Set<number>()
  dati.tornei.forEach((t, i) => {
    if (f.formato && t.formato !== f.formato) return
    // I tornei senza dettagli restano fuori da entrambi i filtri: non si sa
    // dove si siano giocati, e tirare a indovinare falserebbe i numeri.
    if (f.dove === 'online' && t.online !== true) return
    if (f.dove === 'dalvivo' && t.online !== false) return
    if (f.dal && t.data < f.dal) return
    if (f.al && t.data > f.al) return
    if (f.giocatoriMinimi && t.giocatori < f.giocatoriMinimi) return
    dentro.add(i)
  })
  return dentro
}

export type RigaArchetipo = {
  indice: number
  nome: string
  partite: number
  vittorie: number
  pareggi: number
  /** Sulle sole partite decise: i pareggi non sono ne' vinti ne' persi. */
  winrate: number | null
  /** Quanti giocatori l'hanno portato, sui tornei filtrati. */
  giocatori: number
  /** Quota sul totale dei giocatori. */
  share: number | null
}

/**
 * Riepilogo per archetipo sui tornei filtrati.
 *
 * Gli specchi (archetipo contro se stesso) contano una vittoria e una
 * sconfitta a testa, quindi non spostano il winrate: restano nel conteggio
 * partite perche' sono partite davvero giocate.
 */
export function riepilogoArchetipi(dati: DatiMetagame, dentro: Set<number>): RigaArchetipo[] {
  const partite = new Int32Array(dati.archetipi.length)
  const vittorie = new Int32Array(dati.archetipi.length)
  const pareggi = new Int32Array(dati.archetipi.length)
  const giocatori = new Int32Array(dati.archetipi.length)

  for (const [t, a, b, esito] of dati.partite) {
    if (!dentro.has(t)) continue
    partite[a]++
    partite[b]++
    if (esito === PAREGGIO) {
      pareggi[a]++
      pareggi[b]++
    } else if (esito === VINCE_A) {
      vittorie[a]++
    } else {
      vittorie[b]++
    }
  }

  let totaleGiocatori = 0
  for (const i of dentro) {
    const conteggi = dati.tornei[i]?.conteggi ?? {}
    for (const [chiave, n] of Object.entries(conteggi)) {
      const idx = Number(chiave)
      if (Number.isInteger(idx) && idx >= 0 && idx < giocatori.length) {
        giocatori[idx] += n
        totaleGiocatori += n
      }
    }
  }

  return dati.archetipi
    .map((nome, indice) => {
      const decise = partite[indice] - pareggi[indice]
      return {
        indice,
        nome,
        partite: partite[indice],
        vittorie: vittorie[indice],
        pareggi: pareggi[indice],
        winrate: decise > 0 ? vittorie[indice] / decise : null,
        giocatori: giocatori[indice],
        share: totaleGiocatori > 0 ? giocatori[indice] / totaleGiocatori : null,
      }
    })
    .filter((r) => (r.partite > 0 || r.giocatori > 0) && r.nome !== ARCHETIPO_IGNOTO)
    .sort((a, b) => b.partite - a.partite || a.nome.localeCompare(b.nome, 'it'))
}

/** Quante partite, fra i tornei filtrati, hanno almeno un mazzo non registrato. */
export function partiteSenzaLista(dati: DatiMetagame, dentro: Set<number>): number {
  const ignoto = dati.archetipi.indexOf(ARCHETIPO_IGNOTO)
  if (ignoto < 0) return 0
  let n = 0
  for (const [t, a, b] of dati.partite) {
    if (dentro.has(t) && (a === ignoto || b === ignoto)) n++
  }
  return n
}

export type RigaMatchup = {
  indice: number
  nome: string
  partite: number
  vittorie: number
  pareggi: number
  winrate: number | null
  /** Vero per lo specchio: il winrate e' 50% per definizione, non dice niente. */
  specchio: boolean
}

/**
 * Come va un archetipo contro tutti gli altri, dal migliore al peggiore.
 *
 * `minimoPartite` tiene fuori gli incroci da una o due partite, dove una
 * percentuale sarebbe soltanto rumore travestito da informazione.
 */
export function matchupDi(
  dati: DatiMetagame,
  dentro: Set<number>,
  archetipo: number,
  minimoPartite = 1,
): RigaMatchup[] {
  const n = dati.archetipi.length
  const partite = new Int32Array(n)
  const vittorie = new Int32Array(n)
  const pareggi = new Int32Array(n)

  for (const [t, a, b, esito] of dati.partite) {
    if (!dentro.has(t)) continue
    let avversario: number
    let vinta: boolean
    if (a === archetipo) {
      avversario = b
      vinta = esito === VINCE_A
    } else if (b === archetipo) {
      avversario = a
      vinta = esito === VINCE_B
    } else {
      continue
    }
    partite[avversario]++
    if (esito === PAREGGIO) pareggi[avversario]++
    else if (vinta) vittorie[avversario]++
  }

  const righe: RigaMatchup[] = []
  for (let i = 0; i < n; i++) {
    if (partite[i] < minimoPartite || partite[i] === 0) continue
    if (dati.archetipi[i] === ARCHETIPO_IGNOTO) continue
    const decise = partite[i] - pareggi[i]
    righe.push({
      indice: i,
      nome: dati.archetipi[i],
      partite: partite[i],
      vittorie: vittorie[i],
      pareggi: pareggi[i],
      winrate: decise > 0 ? vittorie[i] / decise : null,
      specchio: i === archetipo,
    })
  }

  // Dal migliore al peggiore. A parita' di winrate vince chi ha piu' partite:
  // e' il dato su cui si puo' contare di piu'.
  return righe.sort(
    (a, b) => (b.winrate ?? -1) - (a.winrate ?? -1) || b.partite - a.partite,
  )
}
