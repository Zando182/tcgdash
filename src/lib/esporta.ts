import type { Match } from '../types'
import { oggiIso } from './format'

/** Una cella CSV: si cita sempre, cosi' virgole e a-capo nelle note non rompono il file. */
function cella(v: string | number | null): string {
  const s = v === null ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

const INTESTAZIONI = [
  'Data',
  'Formato',
  'Deck',
  'DeckList',
  'Deck Avversario',
  '1/2',
  'Risultato',
  'Esito',
  'TAG',
  'Torneo',
  'Note',
]

/**
 * CSV con le stesse colonne del foglio "Match" del workbook, cosi' si
 * riapre in Excel senza rimappare niente. Il BOM serve a Excel per capire
 * che il file e' UTF-8: senza, gli accenti diventano caratteri strani.
 */
export function matchInCsv(match: Match[]): string {
  const righe = [...match]
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    .map((m) =>
      [
        m.data,
        m.formato,
        m.deck,
        m.decklist,
        m.avversario,
        m.turno ?? '',
        m.risultato,
        m.risultato === 'W' ? 1 : 0,
        m.tag.join(', '),
        m.torneo,
        m.note,
      ]
        .map(cella)
        .join(','),
    )
  return `﻿${INTESTAZIONI.map(cella).join(',')}\n${righe.join('\n')}\n`
}

export function nomeFile(estensione: string): string {
  return `tcg-match-${oggiIso()}.${estensione}`
}
