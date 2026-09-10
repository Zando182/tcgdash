"""
Lettura e scrittura del workbook TCG, usato come database dei match.

Il foglio "Match" e' la tabella dei dati (colonne A-K compilate a mano, L-R
formule di appoggio gia' presenti fino in fondo); il foglio "Liste", nascosto,
alimenta le tendine di Match e viene rigenerato a ogni scrittura.

Perche' openpyxl va bene qui: il workbook ripulito non contiene piu' grafici
ne' immagini, che sono le cose che openpyxl perde risalvando. Sul workbook
originale (12 grafici, 3 immagini) NON si sarebbe potuto fare: per quello
serve prima `pulisci()`, che le elimina insieme ai fogli che le contengono.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import unicodedata
from copy import copy
from datetime import date, datetime
from pathlib import Path

try:
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill
except ImportError:  # pragma: no cover - dipende dall'ambiente
    raise SystemExit("Serve openpyxl:  pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BACKUP = DATA / "backup"

# Il database. Nome fisso: vedi trova_workbook().
NOME_WORKBOOK = "TCG_Match.xlsx"

FOGLIO_DATI = "Match"
FOGLIO_LISTE = "Liste"
FOGLIO_DECKLIST = "Decklist"
FOGLIO_TORNEI = "Tornei"

# Fogli tenuti dal workbook-database. Tutto il resto (Dashboard, Matrice
# Matchup, le schede per deck, Leggimi) sono elaborazioni che la dashboard
# rifa' meglio, e vengono eliminate da pulisci().
FOGLI_DA_TENERE = {FOGLIO_DATI, FOGLIO_LISTE, FOGLIO_DECKLIST, FOGLIO_TORNEI}

# Foglio Tornei: una riga per partita, come il foglio Match, con i dati del
# torneo e del round ripetuti su ogni riga. Ripetere e' meno elegante di tre
# tabelle collegate, ma e' una tabella sola che si legge, si filtra e si
# ordina in Excel senza sapere niente di chiavi esterne. La colonna ID tiene
# insieme le righe dello stesso torneo, Round e Partita le ordinano.
COLONNE_TORNEI = {
    "A": "id",
    "B": "data",
    "C": "tipologia",
    "D": "formato",
    "E": "deck",
    "F": "decklist",
    "G": "piazzamento",
    "H": "round",
    "I": "avversario",
    "J": "partita",
    "K": "turno",
    "L": "esito",
    "M": "tag",
    "N": "note",
    "O": "risultato",
}
INTESTAZIONI_TORNEI = [
    "ID", "Data", "Tipologia", "Formato", "Mazzo", "Lista", "Piazzamento", "Round",
    "Mazzo avversario", "Partita", "1°/2°", "Esito", "TAG", "Note", "Risultato round",
]
TIPOLOGIE = ("Local", "Challenge", "Sfida di lega", "Amichevole")
PIAZZAMENTI = ("Vittoria", "Finale", "Top 4", "Top 8", "Altro")

# Colonne del foglio Decklist: il testo della lista incollato dal sito.
# E' un dato come i match, non un'elaborazione, quindi vive nel workbook e
# finisce nei backup e nella cronologia di git insieme a tutto il resto.
COLONNE_DECKLIST = {
    "A": "nome",
    "B": "mazzo",
    "C": "aggiornata",
    "D": "testo",
}

PRIMA_RIGA = 2
#

# Colonna del foglio Match -> campo del match. Sono le uniche che si scrivono:
# L-R restano formule del workbook.
COLONNE = {
    "A": "n",
    "B": "data",
    "C": "formato",
    "D": "deck",
    "E": "decklist",
    "F": "avversario",
    "G": "turno",
    "H": "risultato",
    "I": "tag",
    "J": "torneo",
    "K": "note",
}
PRIMA_COLONNA_FORMULE = "L"
COLONNE_FORMULE = "LMNOPQR"

# Colonna del foglio Liste -> come ricavarne i valori dai match.
LISTE = {
    "A": "deck",
    "B": "formato",
    "C": "torneo",
    "D": "risultato",
    "E": "turno",
    "F": "decklist",
    "G": "avversario",
}

# Quante copie di sicurezza tenere in data/backup/.
BACKUP_DA_TENERE = 30


# --------------------------------------------------------------- utilita'


def testo(v) -> str:
    if v is None:
        return ""
    s = str(v).replace("\r\n", "\n").strip()
    return " ".join(s.split()) if "\n" not in s else s.strip()


def normalizza(s: str) -> str:
    """Chiave per confronti tolleranti: minuscolo, senza accenti ne' spazi doppi."""
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.split())


def iso_data(v) -> str:
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = testo(v)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return s


def _turno(v) -> int | None:
    s = testo(v).replace("°", "")
    if s.startswith("1"):
        return 1
    if s.startswith("2"):
        return 2
    return None


def _tag(v, visti: dict[str, str]) -> list[str]:
    """
    Divide i TAG sulla virgola e uniforma le maiuscole: nel workbook convivono
    "Bad Start" e "Bad start", che altrimenti sarebbero due tag diversi.
    """
    fuori: list[str] = []
    for pezzo in testo(v).split(","):
        t = pezzo.strip()
        if not t:
            continue
        canonico = visti.setdefault(normalizza(t), t.title())
        if canonico not in fuori:
            fuori.append(canonico)
    return fuori


def trova_workbook(indicato: str | None = None) -> Path:
    """
    Il workbook-database: data/TCG_Match.xlsx.

    Il nome e' fisso di proposito. Prendere "il .xlsx piu' recente in data/"
    andava bene finche' il file era solo una sorgente da importare; ora che ci
    si scrive dentro, una copia di sicurezza lasciata li' accanto diventerebbe
    il database per sbaglio. Il ripiego sul piu' recente resta solo per chi
    rinomina il file.
    """
    if indicato:
        f = Path(indicato)
        return f if f.is_absolute() else (Path.cwd() / f).resolve()
    preferito = DATA / NOME_WORKBOOK
    if preferito.exists():
        return preferito
    candidati = [f for f in DATA.glob("*.xlsx") if not f.name.startswith("~$")]
    if not candidati:
        raise FileNotFoundError(f"Nessun {NOME_WORKBOOK} (ne' altro .xlsx) in {DATA}.")
    return max(candidati, key=lambda f: f.stat().st_mtime)


def _relativo(p: Path) -> str:
    """Percorso corto da mostrare, o assoluto se il file sta fuori dal progetto."""
    return str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p)


def file_bloccato(percorso: Path) -> bool:
    """
    Vero se il workbook e' aperto in Excel: accanto al file compare un
    `~$nome.xlsx`. Scrivere mentre Excel lo tiene aperto significa perdere la
    scrittura appena Excel risalva, quindi in quel caso ci si ferma.
    """
    return (percorso.parent / f"~${percorso.name}").exists()


# ---------------------------------------------------------------- lettura


def leggi(percorso: Path) -> dict:
    """Il registro come lo vede la dashboard: {liste, match}."""
    wb = openpyxl.load_workbook(percorso, data_only=True)
    if FOGLIO_DATI not in wb.sheetnames:
        raise ValueError(f'{percorso.name}: manca il foglio "{FOGLIO_DATI}".')
    ws = wb[FOGLIO_DATI]

    intestazioni = [testo(c) for c in next(ws.iter_rows(max_row=1, values_only=True))]
    tag_visti: dict[str, str] = {}
    match: list[dict] = []
    scartate = 0

    for riga in range(PRIMA_RIGA, ws.max_row + 1):
        val = {campo: ws[f"{col}{riga}"].value for col, campo in COLONNE.items()}
        deck = testo(val["deck"])
        risultato = testo(val["risultato"]).upper()[:1]
        if not deck or risultato not in ("W", "L"):
            if any(testo(v) for v in val.values()):
                scartate += 1
            continue
        match.append(
            {
                # La riga del foglio e' l'identita' del match: e' stabile finche'
                # non si riscrive il workbook, e la riscrittura passa sempre da qui.
                "id": f"xlsx-{len(match) + 1:03d}",
                "data": iso_data(val["data"]),
                "formato": testo(val["formato"]),
                "deck": deck,
                "decklist": testo(val["decklist"]),
                "avversario": testo(val["avversario"]),
                "turno": _turno(val["turno"]),
                "risultato": risultato,
                "tag": _tag(val["tag"], tag_visti),
                "torneo": testo(val["torneo"]),
                "note": testo(val["note"]),
            }
        )

    match.sort(key=lambda m: (m["data"], m["id"]))

    def elenco(campo: str) -> list[str]:
        return sorted({m[campo] for m in match if m[campo]}, key=normalizza)

    return {
        "decklist": _leggi_decklist(wb),
        "tornei": _leggi_tornei(wb),
        "file": percorso.name,
        "intestazioni": intestazioni,
        "scartate": scartate,
        "liste": {
            "deck": elenco("deck"),
            "decklist": elenco("decklist"),
            "formato": elenco("formato"),
            "avversario": elenco("avversario"),
            "torneo": elenco("torneo"),
            "tag": sorted(set(tag_visti.values()), key=normalizza),
        },
        "match": match,
    }


def _leggi_decklist(wb) -> list[dict]:
    """
    Le liste salvate, dal foglio Decklist.

    Il testo non viene interpretato in nessun modo: e' quello che l'utente ha
    incollato, virgole, righe vuote e refusi compresi. Serve a ritrovarlo, non
    a validarlo.
    """
    if FOGLIO_DECKLIST not in wb.sheetnames:
        return []
    ws = wb[FOGLIO_DECKLIST]
    fuori: list[dict] = []
    for riga in range(PRIMA_RIGA, ws.max_row + 1):
        val = {campo: ws[f"{col}{riga}"].value for col, campo in COLONNE_DECKLIST.items()}
        nome = testo(val["nome"])
        # Il testo si tiene grezzo: solo i ritorni a capo di Windows si
        # normalizzano, altrimenti tornano indietro raddoppiati.
        corpo = "" if val["testo"] is None else str(val["testo"]).replace("\r\n", "\n").strip("\n")
        if not nome and not corpo:
            continue
        fuori.append(
            {
                "id": f"lista-{len(fuori) + 1:03d}",
                "nome": nome,
                "mazzo": testo(val["mazzo"]),
                "aggiornata": iso_data(val["aggiornata"]) if val["aggiornata"] else "",
                "testo": corpo,
            }
        )
    return fuori


def _canonico(valore: str, ammessi: tuple[str, ...]) -> str:
    """Il valore ammesso che corrisponde, ignorando maiuscole; altrimenti quello scritto."""
    chiave = normalizza(valore)
    for a in ammessi:
        if normalizza(a) == chiave:
            return a
    return valore


def _esito_partita(v) -> str:
    """W o L. Accetta anche V/S, per chi compila il foglio a mano in italiano."""
    c = testo(v).upper()[:1]
    return {"W": "W", "V": "W", "L": "L", "S": "L"}.get(c, "")


def esito_round(partite: list[str]) -> str:
    """
    Il risultato di un round al meglio di tre, dalle singole partite.

    Vince chi ha piu' partite vinte: 2-0 e 2-1 sono vittoria, 0-2 e 1-2
    sconfitta, 1-1 pareggio (il tempo e' finito prima della terza). Un 1-0 a
    tempo scaduto va a chi e' avanti, come nel regolamento Pokemon.
    """
    vinte = sum(1 for p in partite if p == "W")
    perse = sum(1 for p in partite if p == "L")
    if vinte == perse == 0:
        return ""
    if vinte > perse:
        return "Vittoria"
    if perse > vinte:
        return "Sconfitta"
    return "Pareggio"


def _leggi_tornei(wb) -> list[dict]:
    """I tornei dal foglio Tornei, raggruppando le righe per torneo e per round."""
    if FOGLIO_TORNEI not in wb.sheetnames:
        return []
    ws = wb[FOGLIO_TORNEI]
    tag_visti: dict[str, str] = {}
    per_id: dict[str, dict] = {}
    for riga in range(PRIMA_RIGA, ws.max_row + 1):
        val = {campo: ws[f"{col}{riga}"].value for col, campo in COLONNE_TORNEI.items()}
        ident = testo(val["id"])
        deck = testo(val["deck"])
        if not ident and not deck:
            continue
        # Una riga senza ID (aggiunta a mano) diventa un torneo a se'.
        ident = ident or f"xlsx-t{riga}"
        t = per_id.get(ident)
        if t is None:
            tipologia = _canonico(testo(val["tipologia"]), TIPOLOGIE) or "Local"
            piazzamento = _canonico(testo(val["piazzamento"]), PIAZZAMENTI) or None
            t = per_id[ident] = {
                "id": ident,
                "data": iso_data(val["data"]),
                "tipologia": tipologia,
                "formato": testo(val["formato"]),
                "deck": deck,
                "decklist": testo(val["decklist"]),
                # In amichevole non ci si piazza: il campo si ignora anche se
                # nel foglio c'e' scritto qualcosa.
                "piazzamento": None if tipologia == "Amichevole" else piazzamento,
                "_round": {},
            }

        avversario = testo(val["avversario"])
        esito = _esito_partita(val["esito"])
        if not avversario and not esito and val["round"] is None:
            continue  # riga del torneo senza round
        try:
            n_round = int(val["round"])
        except (TypeError, ValueError):
            n_round = len(t["_round"]) + 1
        r = t["_round"].setdefault(n_round, {"avversario": avversario, "_partite": []})
        if avversario and not r["avversario"]:
            r["avversario"] = avversario
        if not esito:
            continue  # round registrato senza partite
        try:
            n_partita = int(val["partita"])
        except (TypeError, ValueError):
            n_partita = len(r["_partite"]) + 1
        r["_partite"].append(
            (
                n_partita,
                {
                    "esito": esito,
                    "turno": _turno(val["turno"]),
                    "tag": _tag(val["tag"], tag_visti),
                    "note": testo(val["note"]),
                },
            )
        )

    fuori: list[dict] = []
    for t in per_id.values():
        per_round = t.pop("_round")
        t["round"] = [
            {
                "avversario": per_round[n]["avversario"],
                "partite": [g for _, g in sorted(per_round[n]["_partite"], key=lambda x: x[0])],
            }
            for n in sorted(per_round)
        ]
        fuori.append(t)
    return fuori


# --------------------------------------------------------------- scrittura


def _stili_riga(ws) -> tuple[dict, dict]:
    """
    Gli stili delle prime due righe di dati, colonna per colonna.

    Servono per due motivi: le righe ancora vuote non hanno il formato data
    sulla colonna B (una data scritta li' comparirebbe come 46262), e il
    foglio ha le righe a bande alternate, che si perderebbero.
    """
    pari = {col: copy(ws[f"{col}{PRIMA_RIGA}"]._style) for col in COLONNE}
    dispari = {col: copy(ws[f"{col}{PRIMA_RIGA + 1}"]._style) for col in COLONNE}
    return pari, dispari


def _riga_modello_formule(ws) -> int | None:
    """L'ultima riga che ha ancora le formule di appoggio, da cui copiarle."""
    for riga in range(ws.max_row, PRIMA_RIGA - 1, -1):
        v = ws[f"{PRIMA_COLONNA_FORMULE}{riga}"].value
        if isinstance(v, str) and v.startswith("="):
            return riga
    return None


def _adatta_formula(formula: str, da: int, a: int) -> str:
    """
    Sposta una formula da una riga all'altra.

    Sostituisce solo i riferimenti relativi: il numero di riga preceduto da `$`
    (come in `$D$2`) e' assoluto e non va toccato. Il modello si prende
    dall'ultima riga del foglio proprio per questo — con un numero alto non
    puo' collidere con i riferimenti assoluti alla riga 2.
    """
    return re.sub(r"(?<![$\d])%d(?!\d)" % da, str(a), formula)


def _svuota(ws, riga: int) -> None:
    for col in COLONNE:
        ws[f"{col}{riga}"].value = None


def _scrivi_riga(ws, riga: int, m: dict, stili: tuple[dict, dict], n: int) -> None:
    pari, dispari = stili
    stile = pari if riga % 2 == 0 else dispari
    valori = {
        "A": n,
        "B": datetime.strptime(m["data"], "%Y-%m-%d") if m.get("data") else None,
        "C": testo(m.get("formato")),
        "D": testo(m.get("deck")),
        "E": testo(m.get("decklist")),
        "F": testo(m.get("avversario")),
        "G": m.get("turno") if m.get("turno") in (1, 2) else None,
        "H": testo(m.get("risultato")).upper()[:1],
        "I": ", ".join(t for t in (m.get("tag") or []) if testo(t)),
        "J": testo(m.get("torneo")),
        "K": testo(m.get("note")),
    }
    for col, v in valori.items():
        cella = ws[f"{col}{riga}"]
        cella.value = v if v != "" else None
        cella._style = copy(stile[col])


def _assicura_formule(ws, fino_a: int) -> int:
    """
    Estende le formule di appoggio L-R fino alla riga indicata.

    Il workbook ne arriva con 399 righe gia' pronte: serve solo se il registro
    cresce oltre. Restituisce quante righe sono state aggiunte.
    """
    modello = _riga_modello_formule(ws)
    if modello is None or modello >= fino_a:
        return 0
    formule = {col: ws[f"{col}{modello}"].value for col in COLONNE_FORMULE}
    stili = {col: copy(ws[f"{col}{modello}"]._style) for col in COLONNE_FORMULE}
    for riga in range(modello + 1, fino_a + 1):
        for col in COLONNE_FORMULE:
            cella = ws[f"{col}{riga}"]
            cella.value = _adatta_formula(formule[col], modello, riga)
            cella._style = copy(stili[col])
    return fino_a - modello


def _rigenera_liste(wb, dati: dict) -> None:
    """
    Riscrive il foglio Liste con i valori presenti nel registro e allarga gli
    intervalli delle tendine di Match, cosi' aprendo l'Excel a mano si
    ritrovano anche i mazzi e gli avversari aggiunti dal sito.
    """
    if FOGLIO_LISTE not in wb.sheetnames:
        return
    ws = wb[FOGLIO_LISTE]
    liste = dati["liste"]
    colonne = {
        "A": liste["deck"],
        "B": liste["formato"],
        "C": liste["torneo"],
        "D": ["W", "L"],
        "E": [1, 2],
        "F": liste["decklist"],
        "G": liste["avversario"],
    }

    for col, valori in colonne.items():
        for riga in range(PRIMA_RIGA, max(ws.max_row, PRIMA_RIGA) + 1):
            ws[f"{col}{riga}"].value = None
        for i, v in enumerate(valori):
            ws[f"{col}{PRIMA_RIGA + i}"].value = v

    # Le tendine puntano a intervalli fissi (Liste!$A$2:$A$31): se l'elenco
    # cresce oltre, i valori nuovi non comparirebbero nel menu.
    dati_val = wb[FOGLIO_DATI].data_validations.dataValidation
    for dv in dati_val:
        f = dv.formula1 or ""
        m = re.fullmatch(rf"{FOGLIO_LISTE}!\$([A-G])\$(\d+):\$([A-G])\$(\d+)", f)
        if not m:
            continue
        col = m.group(1)
        n = len(colonne.get(col, []))
        ultima = max(PRIMA_RIGA + n - 1, PRIMA_RIGA)
        dv.formula1 = f"{FOGLIO_LISTE}!${col}${PRIMA_RIGA}:${col}${ultima}"


def _scrivi_decklist(wb, liste: list[dict]) -> int:
    """
    Riscrive il foglio Decklist. Lo crea se non c'e' ancora.

    Come per i match si riscrive tutto invece di aggiungere in fondo: cosi'
    salvataggio, modifica ed eliminazione seguono la stessa strada.
    """
    if FOGLIO_DECKLIST in wb.sheetnames:
        ws = wb[FOGLIO_DECKLIST]
    else:
        ws = wb.create_sheet(FOGLIO_DECKLIST)
        for col, campo in COLONNE_DECKLIST.items():
            c = ws[f"{col}1"]
            c.value = {"nome": "Nome lista", "mazzo": "Mazzo", "aggiornata": "Aggiornata", "testo": "Lista"}[campo]
            c.font = Font(bold=True)
            c.fill = PatternFill("solid", fgColor="F2F2F2")
        ws.column_dimensions["A"].width = 24
        ws.column_dimensions["B"].width = 26
        ws.column_dimensions["C"].width = 13
        ws.column_dimensions["D"].width = 60
        ws.freeze_panes = "A2"

    ultima_prima = ws.max_row
    valide = [l for l in liste if testo(l.get("nome")) or testo(l.get("testo"))]

    for i, lista in enumerate(valide):
        riga = PRIMA_RIGA + i
        ws[f"A{riga}"].value = testo(lista.get("nome"))
        ws[f"B{riga}"].value = testo(lista.get("mazzo"))
        agg = testo(lista.get("aggiornata"))
        ws[f"C{riga}"].value = datetime.strptime(agg, "%Y-%m-%d") if agg else None
        ws[f"C{riga}"].number_format = "dd/mm/yyyy"
        # Il testo va dentro tale e quale: nessuna interpretazione, solo il
        # ritorno a capo automatico per poterlo leggere anche da Excel.
        corpo = lista.get("testo")
        ws[f"D{riga}"].value = None if corpo is None or corpo == "" else str(corpo)
        ws[f"D{riga}"].alignment = Alignment(wrap_text=True, vertical="top")

    for riga in range(PRIMA_RIGA + len(valide), ultima_prima + 1):
        for col in COLONNE_DECKLIST:
            ws[f"{col}{riga}"].value = None

    return len(valide)


def _partita_valida(p) -> dict | None:
    """Una partita di torneo ripulita, o None se non ha un esito."""
    if isinstance(p, str):  # formato di prima: solo "W" o "L"
        p = {"esito": p}
    if not isinstance(p, dict):
        return None
    esito = _esito_partita(p.get("esito"))
    if not esito:
        return None
    turno = p.get("turno")
    return {
        "esito": esito,
        "turno": turno if turno in (1, 2) else None,
        "tag": [testo(x) for x in (p.get("tag") or []) if testo(x)],
        "note": testo(p.get("note")),
    }


def _scrivi_tornei(wb, tornei: list[dict]) -> int:
    """
    Riscrive il foglio Tornei, una riga per partita. Lo crea se manca, e ne
    rifa' l'intestazione se e' ancora nel formato di prima (una riga per round).
    """
    if FOGLIO_TORNEI in wb.sheetnames:
        ws = wb[FOGLIO_TORNEI]
    else:
        ws = wb.create_sheet(FOGLIO_TORNEI)
    if [ws.cell(row=1, column=i + 1).value for i in range(len(INTESTAZIONI_TORNEI))] != INTESTAZIONI_TORNEI:
        for i, nome in enumerate(INTESTAZIONI_TORNEI):
            c = ws.cell(row=1, column=i + 1, value=nome)
            c.font = Font(bold=True)
            c.fill = PatternFill("solid", fgColor="F2F2F2")
        larghezze = [16, 12, 14, 11, 26, 18, 13, 7, 26, 8, 7, 7, 22, 40, 15]
        for col, w in zip(COLONNE_TORNEI, larghezze):
            ws.column_dimensions[col].width = w
        ws.freeze_panes = "A2"

    ultima_prima = ws.max_row
    ordinati = sorted(
        (t for t in tornei if testo(t.get("deck"))),
        key=lambda t: t.get("data") or "",
    )

    riga = PRIMA_RIGA

    def scrivi_riga(valori: dict) -> None:
        nonlocal riga
        for col in COLONNE_TORNEI:
            v = valori.get(col)
            ws[f"{col}{riga}"].value = v if v != "" else None
        ws[f"B{riga}"].number_format = "dd/mm/yyyy"
        ws[f"N{riga}"].alignment = Alignment(wrap_text=True, vertical="top")
        riga += 1

    for t in ordinati:
        tipologia = _canonico(testo(t.get("tipologia")), TIPOLOGIE) or "Local"
        # In amichevole non ci si piazza: nel foglio non deve comparire niente.
        piazzamento = "" if tipologia == "Amichevole" else _canonico(testo(t.get("piazzamento")), PIAZZAMENTI)
        data = testo(t.get("data"))
        torneo = {
            "A": testo(t.get("id")),
            "B": datetime.strptime(data, "%Y-%m-%d") if data else None,
            "C": tipologia,
            "D": testo(t.get("formato")),
            "E": testo(t.get("deck")),
            "F": testo(t.get("decklist")),
            "G": piazzamento,
        }
        rounds = t.get("round") or []
        if not rounds:
            # Un torneo senza round occupa comunque una riga: altrimenti sparirebbe.
            scrivi_riga(torneo)
            continue
        for n, r in enumerate(rounds, start=1):
            partite = [g for g in (_partita_valida(p) for p in (r.get("partite") or [])) if g][:3]
            del_round = {
                **torneo,
                "H": n,
                "I": testo(r.get("avversario")),
                # Scritto solo per chi legge il foglio: rileggendo si ricalcola
                # dalle partite, che sono l'unica fonte.
                "O": esito_round([g["esito"] for g in partite]),
            }
            if not partite:
                scrivi_riga(del_round)
                continue
            for k, g in enumerate(partite, start=1):
                scrivi_riga(
                    {
                        **del_round,
                        "J": k,
                        "K": g["turno"],
                        "L": g["esito"],
                        "M": ", ".join(g["tag"]),
                        "N": g["note"],
                    }
                )

    for r in range(riga, ultima_prima + 1):
        for col in COLONNE_TORNEI:
            ws[f"{col}{r}"].value = None

    return len(ordinati)


def _fai_backup(percorso: Path) -> Path:
    BACKUP.mkdir(parents=True, exist_ok=True)
    quando = datetime.now().strftime("%Y%m%d-%H%M%S")
    copia = BACKUP / f"{percorso.stem}-{quando}{percorso.suffix}"
    shutil.copy2(percorso, copia)
    vecchi = sorted(BACKUP.glob(f"{percorso.stem}-*{percorso.suffix}"))
    for f in vecchi[:-BACKUP_DA_TENERE]:
        f.unlink(missing_ok=True)
    return copia


def scrivi(
    percorso: Path,
    match: list[dict],
    decklist: list[dict] | None = None,
    tornei: list[dict] | None = None,
) -> dict:
    """
    Riscrive le colonne A-K del foglio Match con il registro passato.

    Si riscrive tutta la tabella invece di aggiungere una riga in fondo perche'
    cosi' aggiunta, modifica e cancellazione seguono la stessa strada: quello
    che sta nel foglio e' esattamente quello che sta nella dashboard.
    """
    if file_bloccato(percorso):
        raise PermissionError(
            f"{percorso.name} e' aperto in Excel. Chiudilo e riprova: "
            "scrivere adesso vorrebbe dire perdere le modifiche al primo salvataggio di Excel."
        )

    # Ordinamento stabile sulla sola data: fra partite dello stesso giorno resta
    # l'ordine in cui arrivano dalla dashboard, che e' quello in cui sono state
    # giocate. Ordinare anche per deck le rimescolerebbe a ogni salvataggio.
    validi = [m for m in match if testo(m.get("deck")) and testo(m.get("risultato"))]
    ordinati = sorted(validi, key=lambda m: m.get("data") or "")

    backup = _fai_backup(percorso)
    wb = openpyxl.load_workbook(percorso)
    if FOGLIO_DATI not in wb.sheetnames:
        raise ValueError(f'{percorso.name}: manca il foglio "{FOGLIO_DATI}".')
    ws = wb[FOGLIO_DATI]

    ultima_prima = ws.max_row
    ultima_dopo = PRIMA_RIGA + len(ordinati) - 1
    formule_aggiunte = _assicura_formule(ws, ultima_dopo)

    stili = _stili_riga(ws)
    for i, m in enumerate(ordinati):
        _scrivi_riga(ws, PRIMA_RIGA + i, m, stili, i + 1)

    # Le righe in coda vanno svuotate, non cancellate: sotto ci sono le formule
    # di appoggio, che devono restare pronte per i match futuri.
    svuotate = 0
    for riga in range(ultima_dopo + 1, ultima_prima + 1):
        if testo(ws[f"D{riga}"].value):
            svuotate += 1
        _svuota(ws, riga)

    _rigenera_liste(wb, {"liste": _liste_da(ordinati)})

    # `decklist` assente significa "non toccare quel foglio": un client vecchio
    # che manda solo i match non deve cancellare le liste salvate.
    liste_scritte = None if decklist is None else _scrivi_decklist(wb, decklist)
    tornei_scritti = None if tornei is None else _scrivi_tornei(wb, tornei)

    # Le formule L-R non hanno piu' un valore in cache dopo la riscrittura:
    # senza questo Excel potrebbe mostrarle vuote finche' non si tocca una cella.
    wb.calculation.fullCalcOnLoad = True

    # Scrittura atomica: se qualcosa va storto a meta', il workbook buono resta.
    tmp = percorso.with_suffix(f"{percorso.suffix}.tmp")
    wb.save(tmp)
    os.replace(tmp, percorso)

    return {
        "scritti": len(ordinati),
        "listeScritte": liste_scritte,
        "torneiScritti": tornei_scritti,
        "rimosse": svuotate,
        "formuleAggiunte": formule_aggiunte,
        "backup": _relativo(backup),
    }


def _liste_da(match: list[dict]) -> dict:
    def elenco(campo: str) -> list[str]:
        return sorted({testo(m.get(campo)) for m in match if testo(m.get(campo))}, key=normalizza)

    return {
        "deck": elenco("deck"),
        "decklist": elenco("decklist"),
        "formato": elenco("formato"),
        "avversario": elenco("avversario"),
        "torneo": elenco("torneo"),
    }


# ---------------------------------------------------------------- pulizia


def pulisci(percorso: Path) -> dict:
    """
    Riduce il workbook al solo database: tiene Match e Liste (nascosto) ed
    elimina i fogli di elaborazione, che la dashboard rifa' meglio e in tempo
    reale. Con loro se ne vanno i 12 grafici e le 3 immagini che rendevano
    rischioso risalvare il file da programma.

    E' idempotente: rilanciarla su un workbook gia' ripulito non fa niente.
    """
    wb = openpyxl.load_workbook(percorso)
    da_togliere = [n for n in wb.sheetnames if n not in FOGLI_DA_TENERE]
    if not da_togliere and wb[FOGLIO_LISTE].sheet_state == "hidden":
        return {"rimossi": [], "giaPulito": True}

    backup = _fai_backup(percorso)
    for nome in da_togliere:
        del wb[nome]
    if FOGLIO_LISTE in wb.sheetnames:
        wb[FOGLIO_LISTE].sheet_state = "hidden"
    wb.active = 0
    wb.calculation.fullCalcOnLoad = True

    tmp = percorso.with_suffix(f"{percorso.suffix}.tmp")
    wb.save(tmp)
    os.replace(tmp, percorso)
    return {"rimossi": da_togliere, "giaPulito": False, "backup": _relativo(backup)}


# -------------------------------------------------------------------- stato


def stato(percorso: Path | None = None) -> dict:
    """Cosa puo' dire il server alla dashboard su questo workbook."""
    try:
        f = percorso or trova_workbook()
    except FileNotFoundError as e:
        return {"disponibile": False, "errore": str(e)}
    if not f.exists():
        return {"disponibile": False, "errore": f"{f} non esiste."}
    try:
        dati = leggi(f)
    except Exception as e:  # il workbook potrebbe essere corrotto o di altro tipo
        return {"disponibile": False, "file": str(f), "errore": str(e)}
    return {
        "disponibile": True,
        "file": _relativo(f),
        "match": len(dati["match"]),
        "bloccato": file_bloccato(f),
        "modificato": datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds"),
        "fogli": openpyxl.load_workbook(f, read_only=True).sheetnames,
    }


def json_out(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)
