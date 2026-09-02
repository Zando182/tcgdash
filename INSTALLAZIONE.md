# Come installare TCGDash e cominciare a salvare le partite

Guida passo passo, dal progetto su GitHub alla dashboard aperta nel browser.
Non serve saperne di programmazione: basta copiare i comandi e premere Invio.

Ci sono due strade, **Mac** e **Windows**: segui solo la tua e salta l'altra.

---

## Prima di tutto: tre parole difficili

| Parola | Cosa vuol dire |
| --- | --- |
| **Terminale** (Mac) / **Prompt dei comandi** (Windows) | Una finestra dove si scrivono ordini al computer scrivendoli invece che cliccandoli. Scrivi una riga, premi Invio, aspetti. |
| **Comando** | La riga che scrivi. In questa guida i comandi sono nei riquadri grigi: copiali **esatti**, anche i trattini. |
| **Pacchetto** | Un pezzo di programma già fatto che il progetto usa. Li scarica il computer da solo, tu dai solo il via. |

Una regola per tutta la guida: **dopo ogni comando premi Invio e aspetti che
riappaia la riga con il trattino lampeggiante.** Se il computer sta ancora
scrivendo cose, non ha finito. A volte ci mette un minuto: è normale.

---

# 🍎 MAC

## Passo 1 — Installa Node.js

Node.js è il motore che fa girare la dashboard.

1. Vai su **https://nodejs.org**
2. Clicca il pulsante grande a sinistra (quello che dice **LTS**).
3. Si scarica un file che finisce per `.pkg`. Aprilo con doppio clic.
4. Clicca **Continua → Continua → Installa**. Ti chiede la password del Mac: scrivila.
5. Alla fine clicca **Chiudi**.

## Passo 2 — Controlla che Python ci sia

Python serve per scrivere dentro il file Excel. Sul Mac c'è già.

1. Apri il **Terminale**: premi `Cmd` + `Spazio`, scrivi `Terminale`, premi Invio.
2. Scrivi questo e premi Invio:

```bash
python3 --version
```

Se risponde qualcosa tipo `Python 3.9.6`, sei a posto: vai al Passo 3.

Se dice `command not found`, installalo: vai su **https://www.python.org/downloads/**,
scarica, apri il `.pkg` e clicca sempre Continua.

## Passo 3 — Scarica il progetto

Nella stessa finestra del Terminale, scrivi questi comandi **uno alla volta**,
premendo Invio dopo ognuno:

```bash
cd ~/Documents
```

```bash
git clone https://github.com/Zando182/tcgdash.git
```

```bash
cd tcgdash
```

Il primo comando dice "vai nella cartella Documenti". Il secondo scarica il
progetto da GitHub. Il terzo entra nella cartella appena scaricata.

> Se al secondo comando il Mac ti chiede di installare gli "strumenti per
> sviluppatori", clicca **Installa** e aspetta. Poi ripeti il comando.

## Passo 4 — Installa i pacchetti

Due comandi, uno alla volta. Il primo ci mette un minuto o due.

```bash
npm install
```

```bash
pip3 install openpyxl
```

Il primo scarica i pacchetti della dashboard. Il secondo installa `openpyxl`,
il pacchetto che sa leggere e scrivere i file Excel.

> Se il secondo comando dà un errore lungo che parla di
> `externally-managed-environment`, usa invece questo:
> ```bash
> pip3 install --user --break-system-packages openpyxl
> ```

## Passo 5 — Accendi la dashboard

```bash
npm start
```

Aspetta. Dopo qualche secondo il browser si apre da solo su
`http://localhost:5190` e vedi la dashboard con le tue partite.

**Per spegnerla:** torna nel Terminale e premi `Ctrl` + `C`.

## Passo 6 — Il modo comodo per le prossime volte

Da domani in poi non ti serve più il Terminale.

1. Apri la cartella **Documenti → tcgdash** nel Finder.
2. Dentro c'è un file che si chiama **`avvia.command`**.
3. Fai **doppio clic**. Si apre una finestra nera, aspetti, e la dashboard si apre.

Per averlo sempre a portata di mano: tieni premuti `Cmd` + `Alt` e trascina
`avvia.command` sulla Scrivania. Crea un collegamento (alias) che puoi cliccare
da lì.

> Se il doppio clic apre un editor di testo invece di partire: clicca il file col
> tasto destro → **Apri con** → **Terminale**.

**Vai al capitolo "Come si usa"** in fondo a questa guida. 👇

---

# 🪟 WINDOWS

## Passo 1 — Installa Node.js

Node.js è il motore che fa girare la dashboard.

1. Vai su **https://nodejs.org**
2. Clicca il pulsante grande a sinistra (quello che dice **LTS**).
3. Si scarica un file `.msi`. Aprilo con doppio clic.
4. Clicca **Next → Next → Install**. Se Windows chiede "Vuoi consentire...", clicca **Sì**.
5. Alla fine clicca **Finish**.

## Passo 2 — Installa Python

⚠️ **Questo passo ha una casella da spuntare. Se la salti, non funziona niente.**

1. Vai su **https://www.python.org/downloads/**
2. Clicca il pulsante giallo **Download Python**.
3. Apri il file scaricato.
4. **PRIMA di cliccare Install**, in fondo alla finestra spunta la casella
   **"Add python.exe to PATH"**. È importantissima.
5. Poi clicca **Install Now** e aspetta.

## Passo 3 — Installa Git

1. Vai su **https://git-scm.com/download/win**
2. Il download parte da solo. Apri il file.
3. Clicca **Next** su tutte le schermate senza cambiare niente, poi **Install**.

## Passo 4 — Scarica il progetto

1. Premi il tasto **Windows**, scrivi `cmd`, premi Invio. Si apre una finestra nera.
2. Scrivi questi comandi **uno alla volta**, premendo Invio dopo ognuno:

```bat
cd %USERPROFILE%\Documents
```

```bat
git clone https://github.com/Zando182/tcgdash.git
```

```bat
cd tcgdash
```

Il primo va nella cartella Documenti. Il secondo scarica il progetto. Il terzo
entra nella cartella appena scaricata.

## Passo 5 — Installa i pacchetti

Due comandi, uno alla volta. Il primo ci mette un minuto o due.

```bat
npm install
```

```bat
py -m pip install openpyxl
```

> Se il secondo dice che `py` non esiste, hai saltato la casella
> **"Add python.exe to PATH"** del Passo 2. Reinstalla Python spuntandola.

## Passo 6 — Accendi la dashboard

```bat
npm start
```

Aspetta. Dopo qualche secondo il browser si apre da solo su
`http://localhost:5190` e vedi la dashboard con le tue partite.

> Se Windows mostra un avviso del firewall, clicca **Consenti accesso**.

**Per spegnerla:** torna nella finestra nera e premi `Ctrl` + `C`.

## Passo 7 — Il modo comodo per le prossime volte

Da domani in poi non ti serve più la finestra nera.

1. Apri la cartella **Documenti → tcgdash**.
2. Dentro c'è un file che si chiama **`avvia.cmd`**.
3. Fai **doppio clic**. Si apre una finestra nera, aspetti, e la dashboard si apre.

Per averlo sempre a portata di mano: clicca `avvia.cmd` col tasto destro →
**Mostra altre opzioni** → **Invia a** → **Desktop (crea collegamento)**.

---

# Come si usa

## Controlla che stia salvando nell'Excel

In alto a destra nella dashboard c'è un'etichetta piccola. Guarda lì:

| Cosa vedi | Cosa vuol dire |
| --- | --- |
| 🟢 **Excel** | Perfetto. Ogni partita che inserisci finisce nel file `data/TCG_Match.xlsx`. |
| ⚪️ **browser** | Le partite restano solo dentro il browser e **non** vanno nell'Excel. Vedi "Se qualcosa non va". |

## Salva la tua prima partita

1. Clicca **Inserisci** in alto.
2. Riempi almeno **Il mio mazzo** e **Mazzo avversario**.
3. Scegli **Vittoria** o **Sconfitta**.
4. Se hai imparato qualcosa, scrivilo in **Note della partita**: lo ritrovi nella
   pagina Note, raggruppato per avversario.
5. Clicca **Aggiungi match**.

Fatto. La partita è già dentro l'Excel: apri `data/TCG_Match.xlsx` e la trovi
in fondo al foglio **Match**.

## Le due regole d'oro ⭐️

**1. Chiudi l'Excel prima di inserire partite dal sito.**
Se il file è aperto in Excel, la dashboard non può scriverci. Non perdi niente:
compare una striscia rossa, la partita resta salvata, e quando hai chiuso Excel
clicchi **Riprova**.

**2. Se modifichi l'Excel a mano, premi "Rileggi dal workbook" prima di inserire
dal sito.** Lo trovi nella pagina **Dati**. Senza, la prima partita che inserisci
riscriverebbe il file con la copia vecchia che la pagina ha in memoria.

---

# Modificare l'Excel

Il file è **`data/TCG_Match.xlsx`** dentro la cartella del progetto. È il
database: la dashboard legge da lì e scrive lì.

Ha due fogli soli:

- **Match** — la tabella delle partite. Le colonne da riempire sono quelle da
  **A** a **K** (Data, Formato, Deck, DeckList, Deck Avversario, 1°/2°,
  Risultato, TAG, Torneo, Note). Le colonne da **L** a **R** sono formule: non
  toccarle, si riempiono da sole.
- **Liste** — nascosto. Serve solo alle tendine del foglio Match e si aggiorna
  da solo.

## Aggiungere partite a mano dentro Excel

Puoi farlo tranquillamente: scrivi nella prima riga vuota, dalla colonna A alla
K. Poi, nella dashboard, vai su **Dati** e clicca **Rileggi dal workbook**.

## Ricominciare da zero, senza nessuna partita

1. Apri `data/TCG_Match.xlsx`.
2. Nel foglio **Match**, seleziona le righe dei dati (dalla 2 in giù) e cancella
   **solo le colonne da A a K**. Lascia stare le colonne da L a R.
3. Salva e **chiudi** Excel.
4. Nella dashboard vai su **Dati** e clicca **Rileggi dal workbook**.

Le dashboard diventano vuote: è giusto, non c'è più niente da mostrare.

> Potrebbe comparire un avviso giallo che dice che delle partite sono "rimaste
> solo nel browser" e ti offre di rimetterle nel file. Se hai svuotato apposta,
> **ignoralo**: sparisce da solo ricaricando la pagina.

## Usare un altro file Excel al posto di questo

1. **Spegni** la dashboard (`Ctrl` + `C`, o chiudi la finestra nera).
2. Metti il tuo file dentro la cartella `data/` e chiamalo **esattamente**
   `TCG_Match.xlsx` (sostituisci quello che c'è).
3. Deve avere un foglio che si chiama **Match** con le stesse colonne A-K.
4. Apri il Terminale (o il Prompt) nella cartella del progetto e lancia:

```bash
npm run db:pulisci
```

Questo toglie dal file i fogli di calcolo che non servono più (Dashboard,
Matrice Matchup, le schede per deck), perché la dashboard rifà quelle analisi da
sola e meglio. Fa una copia di sicurezza prima di toccare qualsiasi cosa.

5. Riaccendi con `npm start`.

## Dove finiscono le copie di sicurezza

Ogni volta che la dashboard scrive nel file, prima ne mette una copia in
**`data/backup/`**. Ne tiene le ultime 30. Se combini un guaio, pesca da lì.

---

# Se qualcosa non va

| Cosa vedi | Cosa fare |
| --- | --- |
| L'etichetta in alto dice **browser** invece di **Excel** | Manca Python o `openpyxl`. Rilancia il comando del Passo 4 (Mac) o 5 (Windows). Poi spegni e riaccendi la dashboard. |
| `command not found: npm` (Mac) o `'npm' non è riconosciuto` (Windows) | Node.js non è installato, o non hai chiuso e riaperto il Terminale dopo averlo installato. Chiudi la finestra, riaprila e riprova. |
| `command not found: git` | Mac: lancia `git --version` e accetta l'installazione che propone. Windows: fai il Passo 3. |
| `py` non è riconosciuto (Windows) | Hai saltato la casella "Add python.exe to PATH". Reinstalla Python spuntandola. |
| Striscia rossa: **non sono riuscito a scrivere sull'Excel** | Il file è aperto in Excel. Chiudilo e clicca **Riprova**. Nessuna partita è persa. |
| `Porta 5190 occupata` | La dashboard è già accesa in un'altra finestra. Cercala, oppure chiudi tutte le finestre nere e riprova. |
| Il browser non si apre da solo | Aprilo tu e vai su **http://localhost:5190** |
| La dashboard è vuota | Il foglio **Match** dell'Excel non ha righe valide. Ogni riga ha bisogno almeno del **Deck** (colonna D) e del **Risultato** W o L (colonna H). |

## Aggiornare all'ultima versione

Nel Terminale (o Prompt), dentro la cartella del progetto:

```bash
git pull
```

```bash
npm install
```

Le tue partite non si toccano: stanno nel tuo file Excel.
