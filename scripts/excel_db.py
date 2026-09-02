#!/usr/bin/env python3
"""
Interfaccia a riga di comando fra il server locale e il workbook-database.

Parla JSON: il server Node lancia questo script e legge stdout. Ogni comando
stampa un oggetto JSON; in caso di errore stampa {"errore": "..."} ed esce con
codice 1, cosi' il server puo' girare il messaggio alla dashboard invece di
mostrare una pagina rotta.

    python scripts/excel_db.py stato
    python scripts/excel_db.py leggi
    echo '{"match": [...]}' | python scripts/excel_db.py scrivi
    python scripts/excel_db.py pulisci
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Il server lancia lo script da qualunque cartella: senza questo l'import del
# modulo accanto fallirebbe.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tcg_excel import json_out, leggi, pulisci, scrivi, stato, trova_workbook  # noqa: E402


def main() -> int:
    comando = sys.argv[1] if len(sys.argv) > 1 else "stato"
    indicato = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        if comando == "stato":
            print(json_out(stato(trova_workbook(indicato) if indicato else None)))
            return 0

        percorso = trova_workbook(indicato)

        if comando == "leggi":
            print(json_out(leggi(percorso)))
            return 0

        if comando == "scrivi":
            richiesta = json.load(sys.stdin)
            match = richiesta.get("match")
            if not isinstance(match, list):
                raise ValueError('Richiesta senza elenco "match".')
            decklist = richiesta.get("decklist")
            if decklist is not None and not isinstance(decklist, list):
                raise ValueError('"decklist" deve essere un elenco.')
            print(json_out(scrivi(percorso, match, decklist)))
            return 0

        if comando == "pulisci":
            print(json_out(pulisci(percorso)))
            return 0

        raise ValueError(f"Comando sconosciuto: {comando}")

    except Exception as e:
        print(json_out({"errore": str(e)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
