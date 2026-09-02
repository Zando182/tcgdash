/** Esito di una partita, come nella colonna "Risultato" del workbook. */
export type Esito = 'W' | 'L'

/** Chi ha iniziato: 1 = gioco per primo, 2 = rispondo. */
export type Turno = 1 | 2

export type Match = {
  id: string
  /** Data in ISO (yyyy-mm-dd): unica forma ordinabile e confrontabile. */
  data: string
  /** Espansione / formato di gioco, es. "TEF-PBL". */
  formato: string
  deck: string
  /** Variante della lista usata, es. "Dragapolli v2". */
  decklist: string
  avversario: string
  turno: Turno | null
  risultato: Esito
  tag: string[]
  torneo: string
  note: string
}

/** Elenchi dei valori gia' usati: alimentano i menu a tendina del form. */
export type Liste = {
  deck: string[]
  decklist: string[]
  formato: string[]
  avversario: string[]
  torneo: string[]
  tag: string[]
}

export type Seed = {
  generatoDa: string
  generatoIl: string
  liste: Liste
  match: Match[]
}

/** Le dimensioni su cui si puo' filtrare e spezzare il winrate. */
export type Dimensione = 'deck' | 'avversario' | 'formato' | 'decklist' | 'torneo' | 'turno' | 'tag'

export type Filtri = {
  deck: string[]
  avversario: string[]
  formato: string[]
  decklist: string[]
  torneo: string[]
  turno: Turno[]
  tag: string[]
  /** Estremi ISO inclusivi, stringa vuota = nessun limite. */
  da: string
  a: string
  /** Ricerca libera su note, tag, deck e avversario. */
  cerca: string
  /** Solo i match che hanno una nota scritta. */
  soloConNote: boolean
}
