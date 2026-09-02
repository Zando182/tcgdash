/** Percentuale con una cifra: 0.6333 -> "63,3%". Null quando non c'e' campione. */
export function pct(v: number | null, cifre = 1): string {
  if (v === null || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(cifre).replace('.', ',')}%`
}

/** Winrate su vittorie/partite, null se non ci sono partite. */
export function winrate(vittorie: number, partite: number): number | null {
  return partite > 0 ? vittorie / partite : null
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

/** "2026-08-27" -> "27 ago 2026". */
export function dataIt(iso: string): string {
  const [a, m, g] = iso.split('-').map(Number)
  if (!a || !m || !g) return iso
  return `${g} ${MESI[m - 1]} ${a}`
}

/** "2026-08-27" -> "27 ago". */
export function dataBreve(iso: string): string {
  const [, m, g] = iso.split('-').map(Number)
  if (!m || !g) return iso
  return `${g} ${MESI[m - 1]}`
}

export function oggiIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Chiave per confronti tolleranti: minuscolo, senza accenti ne' spazi doppi. */
export function normalizza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Ordinamento alfabetico italiano, insensibile a maiuscole e accenti. */
export function perNome(a: string, b: string): number {
  return a.localeCompare(b, 'it', { sensitivity: 'base' })
}
