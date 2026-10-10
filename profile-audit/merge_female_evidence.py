#!/usr/bin/env python3
"""Valida e incorpora um dossiê feminino 12/12 produzido por subagente.

O subagente escreve isoladamente em:
    profile-audit/subagent-evidence/personality/<id>.json

Depois o coordenador executa:
    python3 profile-audit/merge_female_evidence.py <id>
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DRAFTS = ROOT / "profile-audit/subagent-evidence/personality"
DEST = ROOT / "scripts/data/female-profile-evidence.json"
AXES = [
    "estrutura", "representacao", "poder", "imigracao", "diplomacia", "intervencao",
    "economia", "controle", "comercio", "religiao", "moral", "tecnologia",
]


def load(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def validate(pid: str, dossier: dict):
    errors = []
    if dossier.get("id") != pid:
        errors.append(f"id divergente: esperado {pid}, recebido {dossier.get('id')}")
    sources = dossier.get("sources")
    if not isinstance(sources, list) or len(sources) < 2:
        errors.append("mínimo de 2 fontes")
    else:
        for index, source in enumerate(sources, 1):
            if not source.get("url") or not source.get("institution"):
                errors.append(f"fonte {index} precisa de url e institution")
    evidence = dossier.get("evidence")
    if not isinstance(evidence, dict):
        errors.append("evidence precisa ser objeto")
        evidence = {}
    unknown = [key for key in evidence if key not in AXES]
    missing = [axis for axis in AXES if not str(evidence.get(axis, "")).strip()]
    if unknown:
        errors.append("eixos desconhecidos: " + ", ".join(unknown))
    if missing:
        errors.append("evidência incompleta; faltam: " + ", ".join(missing))
    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("id")
    parser.add_argument("path", nargs="?", help="Draft alternativo; padrão subagent-evidence/personality/<id>.json")
    parser.add_argument("--check", action="store_true", help="Só valida; não altera o arquivo compartilhado.")
    args = parser.parse_args()

    path = Path(args.path) if args.path else DEFAULT_DRAFTS / f"{args.id}.json"
    if not path.is_absolute():
        path = ROOT / path
    dossier = load(path)
    errors = validate(args.id, dossier)
    if errors:
        print("FALHOU:")
        for error in errors:
            print("- " + error)
        raise SystemExit(1)

    print(f"OK: {args.id} possui 12/12 eixos e {len(dossier['sources'])} fontes")
    if args.check:
        return

    data = load(DEST)
    entries = data.setdefault("personalities", [])
    index = next((i for i, entry in enumerate(entries) if entry.get("id") == args.id), None)
    if index is None:
        entries.append(dossier)
    else:
        entries[index] = dossier
    DEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"merged: {DEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
