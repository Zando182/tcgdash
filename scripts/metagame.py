"""
Dati del metagame dai tornei online della piattaforma Limitless.

Da dove vengono: l'API pubblica di play.limitlesstcg.com, che non richiede
chiave. Per ogni torneo si scaricano le classifiche (chi giocava cosa) e gli
accoppiamenti (chi ha battuto chi); incrociandoli si ricava, partita per
partita, quale archetipo ha battuto quale. Le percentuali le calcola la
dashboard, qui si raccolgono solo i fatti.

Perche' incrementale: l'API concede 50 richieste ogni 5 minuti e ogni torneo
ne costa 2, quindi non si puo' rifare tutto ogni volta. La cache in
data/metagame.json tiene i tornei gia' scaricati e ogni aggiornamento aggiunge
solo quelli nuovi, fermandosi prima di esaurire il credito.

Ogni torneo porta con se' se si e' giocato online o dal vivo (`isOnline` dai
dettagli), cosi' la dashboard puo' separarli. Costa una richiesta in piu' per
torneo, ma e' l'unico modo di distinguerli.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "metagame.json"

API = "https://play.limitlesstcg.com/api"
GIOCO = "PTCG"
UA = "TCGDash/1.0 (dashboard personale, uso non commerciale)"

# Quanti tornei scaricare al massimo per aggiornamento. Ognuno costa tre
# richieste (dettagli, classifica, accoppiamenti): 14 tornei sono 42
# richieste, sotto il tetto di 50 in 5 minuti.
TORNEI_PER_VOLTA = 14

# Sotto questa soglia di richieste rimaste ci si ferma e si riprende dopo:
# meglio un aggiornamento parziale che una raffica di errori 429.
CREDITO_MINIMO = 6

# Tornei troppo piccoli danno matchup che non dicono niente e consumano
# credito: si saltano.
GIOCATORI_MINIMI = 16

# Formati che non si scaricano proprio: il GLC e' un gioco diverso (mazzi
# monotipo, singleton) e i suoi matchup non dicono niente sullo standard.
FORMATI_ESCLUSI = {"GLC"}

# Esiti registrati per ogni partita.
VINCE_A, VINCE_B, PAREGGIO = 1, 2, 0


class LimiteRaggiunto(Exception):
    """Il credito verso l'API e' esaurito: si e' salvato quel che si e' preso."""


def _chiama(percorso: str, parametri: dict | None = None) -> tuple[object, int]:
    """
    Una richiesta all'API. Restituisce (dati, richieste_rimaste).

    Il numero di richieste rimaste arriva dall'header `ratelimit`, nella forma
    `"50-in-5min"; r=45; t=181`: `r` e' il credito residuo.
    """
    url = f"{API}/{percorso}"
    if parametri:
        url += "?" + urllib.parse.urlencode(parametri)
    richiesta = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(richiesta, timeout=30) as r:
            dati = json.load(r)
            intestazione = r.headers.get("ratelimit", "")
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise LimiteRaggiunto("L'API ha risposto 429: troppe richieste.") from e
        raise RuntimeError(f"Limitless ha risposto {e.code} su /{percorso}.") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Non riesco a raggiungere Limitless: {e.reason}") from e

    rimaste = 999
    for pezzo in intestazione.split(";"):
        pezzo = pezzo.strip()
        if pezzo.startswith("r="):
            try:
                rimaste = int(pezzo[2:])
            except ValueError:
                pass
    return dati, rimaste


def cache_vuota() -> dict:
    return {"aggiornato": "", "archetipi": [], "tornei": [], "partite": []}


def leggi_cache() -> dict:
    if not CACHE.exists():
        return cache_vuota()
    try:
        dati = json.loads(CACHE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return cache_vuota()
    for chiave in ("archetipi", "tornei", "partite"):
        if not isinstance(dati.get(chiave), list):
            return cache_vuota()
    return dati


def _salva_cache(dati: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    tmp = CACHE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(dati, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(CACHE)


def _nome_archetipo(voce: dict) -> str:
    deck = voce.get("deck") or {}
    nome = (deck.get("name") or "").strip()
    return nome or "Sconosciuto"


def _dettagli(torneo_id: str) -> tuple[dict, int]:
    """
    Dettagli di un torneo: da qui viene `isOnline`, l'unico campo che dice se
    si e' giocato online o dal vivo. Nell'elenco dei tornei non c'e'.
    """
    dati, rimaste = _chiama(f"tournaments/{torneo_id}/details")
    if not isinstance(dati, dict):
        return {}, rimaste
    return dati, rimaste


def _partite_del_torneo(torneo_id: str) -> tuple[list[tuple[str, str, int]], dict[str, int], int]:
    """
    Le partite di un torneo come (archetipoA, archetipoB, esito), piu' quanti
    giocatori ha portato ogni archetipo.
    """
    classifica, _ = _chiama(f"tournaments/{torneo_id}/standings")
    accoppiamenti, rimaste = _chiama(f"tournaments/{torneo_id}/pairings")

    mazzo: dict[str, str] = {}
    conteggi: dict[str, int] = {}
    for voce in classifica if isinstance(classifica, list) else []:
        giocatore = voce.get("player")
        if not giocatore:
            continue
        nome = _nome_archetipo(voce)
        mazzo[giocatore] = nome
        conteggi[nome] = conteggi.get(nome, 0) + 1

    partite: list[tuple[str, str, int]] = []
    for p in accoppiamenti if isinstance(accoppiamenti, list) else []:
        a, b = p.get("player1"), p.get("player2")
        vincitore = p.get("winner")
        # winner e' lo username del vincitore; 0 e' pareggio, -1 e' bye o
        # partita non giocata. Senza player2 e' comunque un bye.
        if not a or not b:
            continue
        if vincitore == -1 or vincitore == "-1":
            continue
        archA, archB = mazzo.get(a), mazzo.get(b)
        if not archA or not archB:
            continue
        if vincitore in (0, "0"):
            esito = PAREGGIO
        elif vincitore == a:
            esito = VINCE_A
        elif vincitore == b:
            esito = VINCE_B
        else:
            # Vincitore che non e' nessuno dei due: dato inatteso, si scarta
            # invece di indovinare.
            continue
        partite.append((archA, archB, esito))

    return partite, conteggi, rimaste


def _scarta_formati_esclusi(dati: dict) -> int:
    """
    Toglie dalla copia i tornei di formati che non ci interessano piu'.

    Le partite puntano ai tornei per indice, quindi non basta cancellare le
    righe: va rifatta la numerazione, altrimenti ogni partita finirebbe
    attribuita al torneo sbagliato.
    """
    tenuti: list[dict] = []
    nuovo_indice: dict[int, int] = {}
    for vecchio, t in enumerate(dati["tornei"]):
        if (t.get("formato") or "") in FORMATI_ESCLUSI:
            continue
        nuovo_indice[vecchio] = len(tenuti)
        tenuti.append(t)

    tolti = len(dati["tornei"]) - len(tenuti)
    if tolti == 0:
        return 0

    dati["tornei"] = tenuti
    dati["partite"] = [
        [nuovo_indice[p[0]], p[1], p[2], p[3]] for p in dati["partite"] if p[0] in nuovo_indice
    ]
    return tolti


def _completa_dettagli(dati: dict, rimaste: int) -> tuple[int, int, bool]:
    """
    Recupera `online` per i tornei presi prima che lo si registrasse.
    Restituisce (completati, credito residuo, fermato dal limite).
    """
    completati = 0
    for t in dati["tornei"]:
        if t.get("online") is not None:
            continue
        if rimaste <= CREDITO_MINIMO:
            return completati, rimaste, True
        try:
            dett, rimaste = _dettagli(t["id"])
        except LimiteRaggiunto:
            return completati, rimaste, True
        t["online"] = dett.get("isOnline")
        t["piattaforma"] = dett.get("platform") or ""
        t["organizzatore"] = ((dett.get("organizer") or {}).get("name") or "").strip()
        completati += 1
        time.sleep(0.3)
    return completati, rimaste, False


def aggiorna(max_tornei: int = TORNEI_PER_VOLTA, giocatori_minimi: int = GIOCATORI_MINIMI) -> dict:
    """
    Scarica i tornei non ancora in cache e li aggiunge.

    Restituisce un riepilogo di cosa e' stato fatto, compreso quanti tornei
    restano indietro: l'interfaccia lo mostra, cosi' si sa se serve un altro
    giro fra cinque minuti.
    """
    dati = leggi_cache()
    scartati = _scarta_formati_esclusi(dati)
    gia_presi = {t["id"] for t in dati["tornei"]}

    elenco, rimaste = _chiama("tournaments", {"game": GIOCO, "limit": 100})

    # Prima si completano i tornei gia' in copia a cui manca il dato
    # online/dal vivo: senza, il filtro li lascerebbe fuori per sempre.
    completati, rimaste, fermato = _completa_dettagli(dati, rimaste)
    if not isinstance(elenco, list):
        raise RuntimeError("Elenco tornei non valido.")

    candidati = [
        t
        for t in elenco
        if t.get("id")
        and t["id"] not in gia_presi
        and (t.get("players") or 0) >= giocatori_minimi
        and (t.get("format") or "") not in FORMATI_ESCLUSI
    ]

    indice_arch = {nome: i for i, nome in enumerate(dati["archetipi"])}

    def idx(nome: str) -> int:
        if nome not in indice_arch:
            indice_arch[nome] = len(dati["archetipi"])
            dati["archetipi"].append(nome)
        return indice_arch[nome]

    scaricati = 0
    fermato_dal_limite = fermato

    for t in candidati:
        if scaricati >= max_tornei:
            break
        if rimaste <= CREDITO_MINIMO:
            fermato_dal_limite = True
            break
        try:
            dett, rimaste = _dettagli(t["id"])
            partite, conteggi, rimaste = _partite_del_torneo(t["id"])
        except LimiteRaggiunto:
            fermato_dal_limite = True
            break

        i_torneo = len(dati["tornei"])
        dati["tornei"].append(
            {
                "id": t["id"],
                "nome": (t.get("name") or "").strip(),
                "data": (t.get("date") or "")[:10],
                "giocatori": t.get("players") or 0,
                "formato": t.get("format") or "",
                # None quando i dettagli non sono arrivati: meglio "non lo so"
                # che dare per scontato che sia online.
                "online": dett.get("isOnline"),
                "piattaforma": dett.get("platform") or "",
                "organizzatore": ((dett.get("organizer") or {}).get("name") or "").strip(),
                "conteggi": {str(idx(n)): c for n, c in conteggi.items()},
            }
        )
        for archA, archB, esito in partite:
            dati["partite"].append([i_torneo, idx(archA), idx(archB), esito])
        scaricati += 1
        # Un respiro fra un torneo e l'altro: l'API e' gratis, non c'e' motivo
        # di spingerla al limite.
        time.sleep(0.4)

    dati["aggiornato"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    _salva_cache(dati)

    return {
        "scaricati": scaricati,
        "completati": completati,
        "scartati": scartati,
        "restano": max(0, len(candidati) - scaricati),
        "fermatoDalLimite": fermato_dal_limite,
        "creditoResiduo": rimaste,
        "tornei": len(dati["tornei"]),
        "partite": len(dati["partite"]),
        "archetipi": len(dati["archetipi"]),
        "aggiornato": dati["aggiornato"],
    }


def stato() -> dict:
    dati = leggi_cache()
    date = sorted(t["data"] for t in dati["tornei"] if t.get("data"))
    formati = sorted({t.get("formato", "") for t in dati["tornei"] if t.get("formato")})
    return {
        "aggiornato": dati.get("aggiornato", ""),
        "tornei": len(dati["tornei"]),
        "partite": len(dati["partite"]),
        "archetipi": len(dati["archetipi"]),
        "dal": date[0] if date else "",
        "al": date[-1] if date else "",
        "formati": formati,
        "online": sum(1 for t in dati["tornei"] if t.get("online") is True),
        "dalVivo": sum(1 for t in dati["tornei"] if t.get("online") is False),
        "senzaDettagli": sum(1 for t in dati["tornei"] if t.get("online") is None),
    }


# ------------------------------------------------------------------- CLI


def _main() -> int:
    """
    Interfaccia a riga di comando usata dal server locale, come excel_db.py:
    parla JSON su stdout e in caso di errore stampa {"errore": "..."}.

        python scripts/metagame.py stato
        python scripts/metagame.py dati
        python scripts/metagame.py aggiorna [max_tornei]
    """
    import sys

    comando = sys.argv[1] if len(sys.argv) > 1 else "stato"
    try:
        if comando == "stato":
            fuori = stato()
        elif comando == "dati":
            fuori = leggi_cache()
        elif comando == "aggiorna":
            quanti = int(sys.argv[2]) if len(sys.argv) > 2 else TORNEI_PER_VOLTA
            fuori = aggiorna(max_tornei=quanti)
        else:
            raise ValueError(f"Comando sconosciuto: {comando}")
    except Exception as e:
        print(json.dumps({"errore": str(e)}, ensure_ascii=False))
        return 1
    print(json.dumps(fuori, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
