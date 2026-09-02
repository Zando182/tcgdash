# TCGDash

Dashboard locale per il registro partite Pokemon TCG: inserisci i match, e le statistiche si
aggiornano da sole — winrate complessivo e per settimana, matrice matchup, e un playbook che
raccoglie tutte le note che hai scritto, raggruppate per matchup.

Ogni filtro (mazzo, mazzo avversario, espansione, lista, torneo, turno, tag, periodo) vale per
tutte le pagine insieme: scegli il mazzo una volta e panoramica, andamento, matchup e note
mostrano lo stesso sottoinsieme di partite.

Gira senza account e senza server: i match stanno nel browser di chi apre la dashboard
(`localStorage`) e si esportano in JSON o in CSV. Nessun dato esce dal PC.

Il registro di partenza sono i **120 match** del workbook `TCG_Match.xlsx`, gia' inclusi nel
repository.

## Avvio

Serve [Node.js](https://nodejs.org) 20 o superiore. Una volta sola:

```bash
npm install
```

Per **usare** la dashboard:

```bash
npm start
```

Compila la versione ottimizzata, la serve su `http://localhost:5190` e apre il browser da solo.
Su Windows basta il doppio clic su `avvia.cmd`, su macOS su `avvia.command`.

Per lavorare al progetto (ricarica automatica a ogni modifica):

```bash
npm run dev
```

> Non aprire `dist/index.html` con un doppio clic: da `file://` il browser puo' rifiutare
> `localStorage` e i match inseriti sparirebbero alla ricarica. La dashboard lo segnala con un
> avviso in testa alla pagina. Usa `npm start`.

## Le pagine

| Pagina | A cosa serve |
| --- | --- |
| **Inserisci** | Il form per registrare un match e il registro completo, con modifica, duplica ed elimina. I campi che cambiano di rado (espansione, mazzo, lista, torneo) si ricordano dell'ultima partita: in una sessione di ladder cambi solo avversario, turno ed esito. |
| **Panoramica** | Winrate, split 1°/2°, serie in corso, andamento settimanale, confronto fra i tuoi mazzi, avversari piu' incontrati, tag, e gli ultimi match con le note per esteso. |
| **Andamento** | Come cambia il winrate **settimana per settimana**, spezzato su una qualunque dimensione: complessivo, per mazzo, per mazzo avversario, per espansione, per lista, per turno, per torneo, per tag. Con la tabella degli stessi numeri e la variazione fra prima e ultima settimana. |
| **Matchup** | La matrice matchup del workbook, ma con righe e colonne a scelta. Il colore va dal rosso al verde e si accende con le partite giocate. Un puntino ambra segnala che su quel matchup ci sono note. |
| **Note** | Il playbook: ogni nota scritta nei match, raggruppata per matchup (o per avversario, per mazzo, in ordine di data), con ricerca ed evidenziazione. In fondo, gli avversari incontrati piu' volte su cui non hai ancora scritto niente. |
| **Dati** | Backup JSON, export CSV per Excel, import, e ripristino del registro dall'Excel. |

### Come si leggono i numeri

- **Winrate grigio** = meno di 3 partite. Il campione e' troppo piccolo per dire qualcosa: un 1/1
  non e' un matchup dominato.
- **Punto grande sul grafico** = piu' partite in quella settimana. Il volume sta nell'istogramma
  sotto la linea, perche' una percentuale senza volume inganna.
- **Linea spezzata** = settimana senza partite. Unire i punti darebbe l'illusione di un andamento
  che non c'e'.
- **Settimana per settimana / Cumulato** — la prima mostra il winrate del singolo periodo, la
  seconda la media da inizio periodo: si muove meno e mostra la tendenza di fondo.

## Aggiornare i dati dall'Excel

Il registro di partenza vive in `src/data/seed.json`, generato dal foglio **Match** del workbook.
E' committato, quindi ne' l'app ne' il deploy hanno bisogno di Python o del file `.xlsx`.

Per rigenerarlo da un Excel aggiornato: copia il workbook in `data/` e lancia

```bash
npm run ingest
```

Serve Python 3 con `openpyxl` (`pip install openpyxl`). Con `npm run dev` attivo non serve
nemmeno lanciarlo: salvando il `.xlsx` in `data/` il seed si rigenera da solo e la pagina si
ricarica.

Lo script legge le colonne A-K del foglio Match (`#`, `Data`, `Formato`, `Deck`, `DeckList`,
`Deck Avversario`, `1°/2°`, `Risultato`, `TAG`, `Torneo`, `Note`). Le colonne L-R del workbook
sono formule: qui vengono ricalcolate dalla dashboard, quindi si ignorano. I tag vengono divisi
sulla virgola e uniformati nelle maiuscole, cosi' "Bad Start" e "Bad start" non diventano due tag
diversi.

> Rigenerare il seed **non** tocca i match che hai gia' inserito nel browser: quelli stanno nel
> `localStorage` e restano. Per ripartire davvero dall'Excel usa "Ripristina il registro
> dall'Excel" nella pagina Dati (perdendo le modifiche locali).

## Backup e piu' PC

I dati stanno nel browser di chi apre la dashboard: cambiando PC, browser o svuotando la cache si
perdono. **Esporta il JSON dalla pagina Dati** ogni tanto, e reimportalo dove ti serve.

L'export CSV ha le stesse colonne del foglio Match del workbook, quindi si riapre in Excel senza
rimappare niente.

### Pubblicarla su GitHub Pages

`.github/workflows/pages.yml` ripubblica a ogni push su `main`. Servono due cose:

1. repository pubblico (su repository privato Pages richiede GitHub Pro);
2. **Settings → Pages → Source: GitHub Actions** — con `Deploy from a branch` il workflow
   fallisce su `actions/configure-pages`.

La build usa percorsi relativi (`base: './'`), quindi funziona sotto un sottopercorso
`utente.github.io/nome-repo/` senza altre configurazioni.

Anche pubblicata, la dashboard resta locale nel senso che conta: i match stanno nel browser di
chi la apre, non su un server.

## Struttura

```
data/TCG_Match.xlsx        il workbook di partenza
scripts/ingest_xlsx.py     Excel -> src/data/seed.json
scripts/serve.mjs          server statico per dist/, senza dipendenze
src/data/seed.json         registro di partenza, committato
src/types.ts               Match, Filtri, Dimensione
src/lib/stats.ts           settimane ISO, filtri, aggregazioni, andamento, matrice matchup
src/lib/format.ts          percentuali, date italiane, ordinamenti
src/lib/esporta.ts         CSV con le colonne del foglio Match
src/store/useMatch.ts      registro + persistenza in localStorage
src/store/useFiltri.ts     filtri condivisi da tutte le pagine
src/components/            una vista per pagina, piu' charts.tsx (SVG, nessuna libreria) e ui.tsx
```

I grafici sono SVG scritti a mano: nessuna libreria di charting, nessuna richiesta di rete, la
pagina funziona anche offline.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm start` | Build + server locale su `http://localhost:5190`, apre il browser |
| `npm run dev` | Server di sviluppo con ricarica automatica e auto-ingest dell'Excel |
| `npm run build` | Compila in `dist/` |
| `npm run preview` | Serve `dist/` con l'anteprima di Vite |
| `npm run typecheck` | Controllo dei tipi TypeScript |
| `npm run ingest` | Rigenera `src/data/seed.json` dal `.xlsx` piu' recente in `data/` |
| `npm run serve` | Serve `dist/` senza ricompilare |

## Stack

React 19 + TypeScript + Vite 6 + Tailwind 4 + zustand. Nessuna dipendenza runtime oltre a React e
zustand.
