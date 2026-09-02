import { Section } from './ui'

/**
 * Segnaposto della sezione Metagame.
 *
 * Deliberatamente vuota: mostrare grafici finti o dati inventati farebbe
 * sembrare pronta una sezione che non lo e'. Qui si dice solo che e' in
 * lavorazione e cosa la distingue dall'altra sezione.
 */
export function MetagameView() {
  return (
    <Section title="Metagame">
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="text-4xl" aria-hidden>
          🚧
        </span>
        <h2 className="text-lg font-semibold text-ink-100">Lavori in corso</h2>
        <p className="max-w-md text-sm leading-relaxed text-ink-400">
          Questa sezione non e' ancora pronta. Mentre “La mia Dashboard” guarda le{' '}
          <em>tue</em> partite, il Metagame guardera' il campo da gioco nel suo complesso.
        </p>
        <p className="max-w-md text-[13px] text-ink-600">
          Nel frattempo tutto quello che ti serve e' nella sezione La mia Dashboard.
        </p>
      </div>
    </Section>
  )
}
