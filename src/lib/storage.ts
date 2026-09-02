/**
 * Verifica che il browser conceda davvero localStorage.
 *
 * Aprendo la dashboard da file:// o in finestra anonima la scrittura puo'
 * essere bloccata: senza questo controllo i match sembrerebbero salvati e alla
 * prima ricarica sparirebbero.
 */
export function storageDisponibile(): boolean {
  try {
    const chiave = '__tcgdash_probe__'
    localStorage.setItem(chiave, '1')
    const ok = localStorage.getItem(chiave) === '1'
    localStorage.removeItem(chiave)
    return ok
  } catch {
    return false
  }
}

/** Scarica un file generato al volo (export JSON e CSV). */
export function scarica(nome: string, contenuto: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenuto], { type: `${tipo};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Un revoke immediato puo' arrivare prima che il browser legga il blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
