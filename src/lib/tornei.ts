import type { Esito, Match, Round, TorneoMio } from '../types'

export type EsitoRound = 'V' | 'P' | 'S'

/**
 * Il risultato di un round al meglio di tre, dalle singole partite.
 *
 * Vince chi ha piu' partite vinte: 2-0 e 2-1 sono vittoria, 0-2 e 1-2
 * sconfitta, 1-1 pareggio (il tempo e' finito prima della terza). Un 1-0 a
 * tempo scaduto va a chi e' avanti, come nel regolamento Pokemon. Senza
 * partite il round non ha risultato.
 *
 * Stessa regola di `esito_round` in scripts/tcg_excel.py: se cambia una, va
 * cambiata anche l'altra.
 */
export function esitoRound(partite: Esito[]): EsitoRound | null {
  const vinte = partite.filter((p) => p === 'W').length
  const perse = partite.filter((p) => p === 'L').length
  if (vinte === 0 && perse === 0) return null
  if (vinte > perse) return 'V'
  if (perse > vinte) return 'S'
  return 'P'
}

export const ETICHETTA_ROUND: Record<EsitoRound, string> = {
  V: 'Vittoria',
  P: 'Pareggio',
  S: 'Sconfitta',
}

export type Record3 = { v: number; p: number; s: number }

/** Round vinti, pareggiati e persi. */
export function recordRound(round: Round[]): Record3 {
  const r: Record3 = { v: 0, p: 0, s: 0 }
  for (const x of round) {
    const e = esitoRound(x.partite)
    if (e === 'V') r.v++
    else if (e === 'P') r.p++
    else if (e === 'S') r.s++
  }
  return r
}

/** Partite singole vinte e perse, sommando tutti i round. */
export function recordPartite(round: Round[]): { v: number; s: number } {
  let v = 0
  let s = 0
  for (const x of round) {
    for (const p of x.partite) {
      if (p === 'W') v++
      else s++
    }
  }
  return { v, s }
}

export const eAmichevole = (tipologia: string) => tipologia.trim().toLowerCase() === 'amichevole'

/**
 * Le partite dei tornei come match singoli, per le statistiche.
 *
 * Ogni partita di ogni round diventa un match contro l'avversario del round,
 * con la tipologia del torneo nella colonna Torneo: cosi' winrate, matchup e
 * panoramica le contano insieme alle altre, e il filtro Torneo le separa.
 *
 * Esistono solo in memoria: nel workbook stanno nel foglio Tornei, non in
 * Match, e non vanno mai scritte li' — sarebbero contate due volte.
 */
export function partiteDaTornei(tornei: TorneoMio[]): Match[] {
  const fuori: Match[] = []
  for (const t of tornei) {
    t.round.forEach((r, i) => {
      if (!r.avversario.trim()) return
      r.partite.forEach((esito, k) => {
        fuori.push({
          id: `${t.id}-r${i + 1}-g${k + 1}`,
          data: t.data,
          formato: t.formato,
          deck: t.deck,
          decklist: t.decklist,
          avversario: r.avversario,
          // Chi inizia nelle singole partite di un BO3 non si registra.
          turno: null,
          risultato: esito,
          tag: [],
          torneo: t.tipologia,
          note: '',
        })
      })
    })
  }
  return fuori
}
