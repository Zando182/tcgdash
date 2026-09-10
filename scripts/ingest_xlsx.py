#!/usr/bin/env python3
"""
Genera src/data/seed.json dal foglio "Match" del workbook.

Il seed e' il registro di partenza: serve alla dashboard quando non c'e' il
server locale (aperta da GitHub Pages, o senza Python), e al build, che cosi'
non ha bisogno ne' di Python ne' del file .xlsx. Con il server locale attivo
il seed non viene usato: comanda il workbook.

    python scripts/ingest_xlsx.py [file.xlsx]

Senza argomenti usa data/TCG_Match.xlsx.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tcg_excel import ROOT, leggi, trova_workbook  # noqa: E402

USCITA = ROOT / "src" / "data" / "seed.json"


def main() -> int:
    try:
        sorgente = trova_workbook(sys.argv[1] if len(sys.argv) > 1 else None)
        dati = leggi(sorgente)
    except Exception as e:
        print(f"Ingest fallito: {e}", file=sys.stderr)
        return 1

    match = dati["match"]
    if not match:
        print(f"{sorgente.name}: nessun match nel foglio Match.", file=sys.stderr)
        return 1

    seed = {
        "generatoDa": sorgente.name,
        "generatoIl": datetime.now().date().isoformat(),
        "liste": dati["liste"],
        "decklist": dati["decklist"],
        "tornei": dati["tornei"],
        "match": match,
    }
    USCITA.parent.mkdir(parents=True, exist_ok=True)
    USCITA.write_text(json.dumps(seed, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    vinte = sum(1 for m in match if m["risultato"] == "W")
    print(f"{sorgente.name} -> {USCITA.relative_to(ROOT)}")
    print(
        f"  {len(match)} match, {vinte}V/{len(match) - vinte}S ({vinte / len(match):.1%}), "
        f"{len(seed['liste']['deck'])} deck, {len(seed['liste']['avversario'])} avversari, "
        f"{sum(1 for m in match if m['note'])} note, "
        f"{len(dati['decklist'])} liste, {len(dati['tornei'])} tornei"
        + (f", {dati['scartate']} righe incomplete ignorate" if dati["scartate"] else "")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
