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
except ImportError:  # pragma: no cover - dipende dall'ambiente
    raise SystemExit("Serve openpyxl:  pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BACKUP = DATA / "backup"

# Il database. Nome fisso: vedi trova_workbook().
NOME_WORKBOOK = "TCG_Match.xlsx"

FOGLIO_DATI = "Match"
FOGLIO_LISTE = "Liste"

# Fogli tenuti dal workbook-database. Tutto il resto (Dashboard, Matrice
# Matchup, le schede per deck, Leggimi) sono elaborazioni che la dashboard
# rifa' meglio, e vengono eliminate da pulisci().
FOGLI_DA_TENERE = {FOGLIO_DATI, FOGLIO_LISTE}

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


def _fai_backup(percorso: Path) -> Path:
    BACKUP.mkdir(parents=True, exist_ok=True)
    quando = datetime.now().strftime("%Y%m%d-%H%M%S")
    copia = BACKUP / f"{percorso.stem}-{quando}{percorso.suffix}"
    shutil.copy2(percorso, copia)
    vecchi = sorted(BACKUP.glob(f"{percorso.stem}-*{percorso.suffix}"))
    for f in vecchi[:-BACKUP_DA_TENERE]:
        f.unlink(missing_ok=True)
    return copia


def scrivi(percorso: Path, match: list[dict]) -> dict:
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

    # Le formule L-R non hanno piu' un valore in cache dopo la riscrittura:
    # senza questo Excel potrebbe mostrarle vuote finche' non si tocca una cella.
    wb.calculation.fullCalcOnLoad = True

    # Scrittura atomica: se qualcosa va storto a meta', il workbook buono resta.
    tmp = percorso.with_suffix(f"{percorso.suffix}.tmp")
    wb.save(tmp)
    os.replace(tmp, percorso)

    return {
        "scritti": len(ordinati),
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
