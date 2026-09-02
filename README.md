# TCGDash

Dashboard locale per il registro partite Pokemon TCG. Inserisci i match dal sito e finiscono
direttamente nel workbook `data/TCG_Match.xlsx`, che resta il database: winrate complessivo e per
settimana, matrice matchup e un playbook che raccoglie tutte le note, raggruppate per matchup.

Ogni filtro (mazzo, mazzo avversario, espansione, lista, torneo, turno, tag, periodo) vale per
tutte le pagine insieme: scegli il mazzo una volta e panoramica, andamento, matchup e note
mostrano lo stesso sottoinsieme di partite.

## Avvio

Serve [Node.js](https://nodejs.org) 20 o superiore e, per scrivere sull'Excel, Python 3 con
`openpyxl`. Una volta sola:

```bash
npm install && pip install openpyxl
```

Poi, ogni volta:

```bash
npm start
```

Compila, serve su `http://localhost:5190` e apre il browser da solo. Su Windows basta il doppio
clic su `avvia.cmd`, su macOS su `avvia.command`.

Per lavorare al progetto (ricarica automatica a ogni modifica) `npm run dev`: scrive sull'Excel
esattamente come `npm start`.

## Il workbook e' il database

Il browser non puo' scrivere su disco, quindi il salvataggio passa dal server locale: la pagina
chiama `/api/excel/registro`, il server lancia `scripts/excel_db.py` e questo riscrive le colonne
A-K del foglio **Match**. Le colonne L-R restano le formule del workbook, gia' pronte fino a
riga 400 ed estese da sole se il registro cresce oltre.

Si riscrive tutta la tabella a ogni salvataggio, non solo la riga nuova: cosi' aggiunta, modifica
e cancellazione seguono la stessa strada, e quello che sta nel foglio e' esattamente quello che
sta nella dashboard. Effetto collaterale utile: il foglio resta sempre in ordine di data.

In alto a destra un'etichetta dice sempre dove stanno finendo i match:

| Etichetta | Cosa succede |
| --- | --- |
| **Excel** (verde) | Server locale attivo: ogni match viene scritto su `data/TCG_Match.xlsx`. Il browser ne tiene comunque una copia. |
| **browser** (grigio) | Nessun server, o Python assente: i match restano in `localStorage`, come una qualunque pagina statica. |

### Se l'Excel e' aperto

Scrivere mentre Excel tiene il file aperto significa perdere tutto al primo salvataggio di Excel,
quindi in quel caso la dashboard **si ferma e lo dice**: compare una banda rossa, il match resta
salvato nel browser e un pulsante *Riprova* riscrive il workbook appena hai chiuso Excel. Niente
va perso.

Se dei match restano solo nel browser (inseriti senza server, o mentre l'Excel era aperto), alla
riapertura la pagina **Dati** li elenca e li rimanda nel workbook con un clic.

### Sicurezze

- Prima di ogni scrittura una copia finisce in `data/backup/` (le ultime 30, non versionate).
- La scrittura e' atomica: file temporaneo e poi rinomina, quindi un errore a meta' non lascia un
  workbook rotto.
- Il workbook e' versionato in git: `git diff` non lo mostra leggibile, ma ogni commit ne conserva
  una versione intera. E' l'unico motivo per cui questo progetto sta su git.

## Il workbook ripulito

Il file di partenza aveva dieci fogli: oltre a Match c'erano Dashboard, Matrice Matchup, una
scheda per ogni deck, Leggimi e Liste, con 12 grafici e 3 immagini. Erano elaborazioni che la
dashboard rifa' in tempo reale e filtrabili, quindi sono state eliminate (`npm run db:pulisci`).

Restano due fogli, e il file e' passato da **428 KB a 53 KB**:

- **Match** — la tabella dei dati, invariata: stesse colonne, stesse formule, stessa
  formattazione condizionale, stesse tendine.
- **Liste** (nascosto) — la sorgente delle tendine di Match. Non e' un'elaborazione: senza, i
  menu a discesa del foglio si romperebbero. Viene rigenerato a ogni scrittura, quindi contiene
  sempre anche i mazzi e gli avversari aggiunti dal sito.

### Dove sono finite le analisi dei fogli eliminati

| Foglio eliminato | Dove si trova adesso |
| --- | --- |
| **Dashboard** → partite, winrate, deck attivi | Panoramica, riquadri in alto |
| **Dashboard** → confronto deck con winrate da 1° e da 2° | Panoramica, tabella "Confronto tra mazzi" |
| **Matrice Matchup** → winrate e numero partite per incrocio | Matchup, con righe e colonne a scelta e i conteggi dentro la cella |
| **Scheda deck** → riepilogo generale, winrate da 1°/2° | Panoramica, filtrando su quel mazzo |
| **Scheda deck** → winrate per matchup | Panoramica, "Mazzi avversari piu' incontrati" |
| **Scheda deck** → winrate per formato | Matchup, righe = Mio mazzo, colonne = Espansione |
| **Scheda deck** → winrate per turno | Andamento, "Per turno", oppure i riquadri della Panoramica |
| **Scheda deck** → note per avversario | Note, il playbook (raggruppato per matchup, con ricerca) |
| **Leggimi** | Questo README e i testi di aiuto sotto ogni titolo |

In piu', rispetto al workbook, la dashboard aggiunge l'andamento del winrate **per settimana** su
qualunque dimensione, la serie in corso, i tag e la ricerca nelle note.

## Le pagine

| Pagina | A cosa serve |
| --- | --- |
| **Inserisci** | Il form per registrare un match e il registro completo, con modifica, duplica ed elimina. I campi che cambiano di rado (espansione, mazzo, lista, torneo) si ricordano dell'ultima partita: in una sessione di ladder cambi solo avversario, turno ed esito. |
| **Panoramica** | Winrate, split 1°/2°, serie in corso, andamento settimanale, confronto fra i tuoi mazzi, avversari piu' incontrati, tag, e gli ultimi match con le note per esteso. |
| **Andamento** | Come cambia il winrate **settimana per settimana**, spezzato su una qualunque dimensione: complessivo, per mazzo, per mazzo avversario, per espansione, per lista, per turno, per torneo, per tag. Con la tabella degli stessi numeri e la variazione fra prima e ultima settimana. |
| **Matchup** | La matrice matchup, con righe e colonne a scelta. Il colore va dal rosso al verde e si accende con le partite giocate. Un puntino ambra segnala che su quel matchup ci sono note. |
| **Note** | Il playbook: ogni nota scritta nei match, raggruppata per matchup (o per avversario, per mazzo, in ordine di data), con ricerca ed evidenziazione. In fondo, gli avversari incontrati piu' volte su cui non hai ancora scritto niente. |
| **Dati** | Dove finiscono i match, stato del workbook, backup JSON, export CSV, import. |

### Come si leggono i numeri

- **Winrate grigio** = meno di 3 partite. Il campione e' troppo piccolo per dire qualcosa: un 1/1
  non e' un matchup dominato.
- **Punto grande sul grafico** = piu' partite in quella settimana. Il volume sta nell'istogramma
  sotto la linea, perche' una percentuale senza volume inganna.
- **Linea spezzata** = settimana senza partite. Unire i punti darebbe l'illusione di un andamento
  che non c'e'.
- **Settimana per settimana / Cumulato** — la prima mostra il winrate del singolo periodo, la
  seconda la media da inizio periodo: si muove meno e mostra la tendenza di fondo.

## Backup ed export

- **JSON** — backup completo del registro, si reimporta dalla stessa pagina.
- **CSV** — stesse colonne del foglio Match, si riapre in Excel senza rimappare niente.

## Il seed

`src/data/seed.json` e' il registro di partenza committato: serve alla dashboard quando non c'e'
il server locale e al build, che cosi' non ha bisogno ne' di Python ne' del `.xlsx`. Con il server
attivo non viene usato: comanda il workbook.

Per riallinearlo al workbook di oggi:

```bash
npm run ingest
```

Con `npm run dev` attivo succede da solo appena salvi un `.xlsx` in `data/`.

## Pubblicarla su GitHub Pages

`.github/workflows/pages.yml` ripubblica a ogni push su `main`. Servono repository pubblico e
**Settings → Pages → Source: GitHub Actions**.

Pubblicata, la dashboard funziona in modalita' **browser**: il sito non puo' scrivere sul tuo
disco, quindi mostra il seed e salva in `localStorage`. La modalita' Excel esiste solo in locale.

## Struttura

```
data/TCG_Match.xlsx        il database: foglio Match + Liste (nascosto)
data/backup/               copie automatiche prima di ogni scrittura (non versionate)
scripts/tcg_excel.py       lettura, scrittura e pulizia del workbook
scripts/excel_db.py        CLI JSON usata dal server (stato / leggi / scrivi / pulisci)
scripts/api.mjs            rotte /api/excel/*, montate sia da serve.mjs sia da vite.config.ts
scripts/ingest_xlsx.py     workbook -> src/data/seed.json
scripts/serve.mjs          server statico per dist/ + API, senza dipendenze
src/lib/stats.ts           settimane ISO, filtri, aggregazioni, andamento, matrice matchup
src/lib/api.ts             cliente dell'API locale
src/store/useMatch.ts      registro, modalita' Excel/browser, scrittura verso il workbook
src/store/useFiltri.ts     filtri condivisi da tutte le pagine
src/components/            una vista per pagina, piu' charts.tsx (SVG, nessuna libreria) e ui.tsx
```

I grafici sono SVG scritti a mano: nessuna libreria di charting, nessuna richiesta di rete.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm start` | Build + server locale su `http://localhost:5190`, apre il browser |
| `npm run dev` | Server di sviluppo con ricarica automatica (scrive sull'Excel come `npm start`) |
| `npm run build` | Compila in `dist/` |
| `npm run typecheck` | Controllo dei tipi TypeScript |
| `npm run db` | Stato del workbook: quanti match, quali fogli, se e' aperto in Excel |
| `npm run db:pulisci` | Elimina dal workbook i fogli di elaborazione (idempotente) |
| `npm run ingest` | Riallinea `src/data/seed.json` al workbook |
| `npm run serve` | Serve `dist/` senza ricompilare |

## Stack

React 19 + TypeScript + Vite 6 + Tailwind 4 + zustand, piu' Python 3 con `openpyxl` per il lato
Excel. Nessuna dipendenza runtime oltre a React e zustand.
