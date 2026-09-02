import { create } from 'zustand'
import { FILTRI_VUOTI } from '../lib/stats'
import type { Filtri, Turno } from '../types'

/**
 * I filtri vivono in uno store a parte perche' sono condivisi da tutte le
 * dashboard: si sceglie il mazzo una volta e panoramica, andamento, matchup e
 * note mostrano tutte lo stesso sottoinsieme di partite.
 */
export type StatoFiltri = {
  filtri: Filtri
  imposta: <K extends keyof Filtri>(campo: K, valore: Filtri[K]) => void
  /** Aggiunge o toglie un valore da un filtro a scelta multipla. */
  commuta: (campo: 'deck' | 'avversario' | 'formato' | 'decklist' | 'torneo' | 'tag', valore: string) => void
  commutaTurno: (valore: Turno) => void
  azzera: () => void
  /** Filtra su un solo valore, sostituendo la selezione: usato dai grafici cliccabili. */
  soloQuesto: (
    campo: 'deck' | 'avversario' | 'formato' | 'decklist' | 'torneo' | 'tag',
    valore: string,
  ) => void
}

export const useFiltri = create<StatoFiltri>((set) => ({
  filtri: FILTRI_VUOTI,

  imposta: (campo, valore) => set((s) => ({ filtri: { ...s.filtri, [campo]: valore } })),

  commuta: (campo, valore) =>
    set((s) => {
      const attuale = s.filtri[campo]
      return {
        filtri: {
          ...s.filtri,
          [campo]: attuale.includes(valore)
            ? attuale.filter((v) => v !== valore)
            : [...attuale, valore],
        },
      }
    }),

  commutaTurno: (valore) =>
    set((s) => ({
      filtri: {
        ...s.filtri,
        turno: s.filtri.turno.includes(valore)
          ? s.filtri.turno.filter((v) => v !== valore)
          : [...s.filtri.turno, valore],
      },
    })),

  azzera: () => set({ filtri: FILTRI_VUOTI }),

  soloQuesto: (campo, valore) =>
    set((s) => ({
      filtri: {
        ...s.filtri,
        [campo]: s.filtri[campo].length === 1 && s.filtri[campo][0] === valore ? [] : [valore],
      },
    })),
}))
