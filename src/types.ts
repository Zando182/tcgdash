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

/**
 * Una lista salvata: il testo incollato dal sito, cosi' com'e'.
 *
 * `testo` non viene mai interpretato — niente conteggio carte, niente
 * validazione, niente formato imposto. E' un blocco di testo che serve a
 * ritrovare cosa c'era dentro un mazzo, non a controllarlo.
 */
export type Lista = {
  id: string
  /** Come si chiama la lista, es. "Dragapolli v3". Corrisponde alla colonna DeckList dei match. */
  nome: string
  /** Il mazzo a cui appartiene, se indicato. */
  mazzo: string
  /** Data ISO dell'ultimo salvataggio, stringa vuota se mai indicata. */
  aggiornata: string
  testo: string
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
  /** Assente nei seed generati prima che esistessero le liste salvate. */
  decklist?: Lista[]
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
