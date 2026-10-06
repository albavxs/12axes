#!/usr/bin/env python3
"""Fila derivada da expansão feminina de 200 perfis.

Não mantém estado próprio. A fonte de verdade é o runtime, o manifest de staging,
os dossiês de evidência e os arquivos permanentes de auditoria.

Uso:
    python3 profile-audit/female_audit_queue.py
    python3 profile-audit/female_audit_queue.py --batch 1
    python3 profile-audit/female_audit_queue.py --json
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "backend/src/main/resources/data"
PIPELINE = ROOT / "scripts/data"
ANSWERS = ROOT / "profile-audit/answers/personality"
DRAFTS = ROOT / "profile-audit/subagent-out/personality"
EVIDENCE_DRAFTS = ROOT / "profile-audit/subagent-evidence/personality"

AXES = [
    "estrutura", "representacao", "poder", "imigracao", "diplomacia", "intervencao",
    "economia", "controle", "comercio", "religiao", "moral", "tecnologia",
]
STATUS_PRIORITY = {"review": 0, "proposed": 1, "researching": 2, "pending": 3, "ready": 4}
BATCH_SIZE = 15


def load(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def evidence_state(dossier):
    evidence = (dossier or {}).get("evidence") or {}
    present = [axis for axis in AXES if axis in evidence and str(evidence[axis]).strip()]
    missing = [axis for axis in AXES if axis not in present]
    return present, missing


def build_queue():
    personalities = load(DATA / "personalities.json")
    manifest = load(PIPELINE / "female-expansion.json")
    evidence = load(PIPELINE / "female-profile-evidence.json")

    evidence_by_id = {entry["id"]: entry for entry in evidence.get("personalities", [])}
    # Dossiês isolados são evidência provisória durante a produção em lote.
    # Eles sobrepõem o consolidado para a fila, mas só entram no JSON compartilhado
    # depois da revisão humana final.
    if EVIDENCE_DRAFTS.exists():
        for path in EVIDENCE_DRAFTS.glob("*.json"):
            try:
                draft = load(path)
            except (OSError, json.JSONDecodeError):
                continue
            if isinstance(draft, dict) and draft.get("id"):
                evidence_by_id[draft["id"]] = draft
    audited = {path.stem for path in ANSWERS.glob("*.json")} if ANSWERS.exists() else set()
    drafts = {path.stem for path in DRAFTS.glob("*.json")} if DRAFTS.exists() else set()

    def phase_for(pid, missing):
        if missing:
            return "research"
        if pid in drafts:
            return "review"
        return "audit"
    runtime_ids = {entry["id"] for entry in personalities}
    rows = []

    for person in personalities:
        if person.get("representation") != "female" or person["id"] in audited:
            continue
        present, missing = evidence_state(evidence_by_id.get(person["id"]))
        rows.append({
            "id": person["id"],
            "name": person.get("name", person["id"]),
            "source": "runtime",
            "profileStatus": "backfill",
            "priority": -1,
            "evidenceAxes": len(present),
            "missingAxes": missing,
            "phase": phase_for(person["id"], missing),
        })

    for candidate in manifest.get("candidates", []):
        pid = candidate["id"]
        if pid in runtime_ids or pid in audited:
            continue
        present, missing = evidence_state(evidence_by_id.get(pid))
        status = candidate.get("profileStatus", "pending")
        rows.append({
            "id": pid,
            "name": candidate.get("name", pid),
            "source": "staging",
            "profileStatus": status,
            "priority": STATUS_PRIORITY.get(status, 99),
            "evidenceAxes": len(present),
            "missingAxes": missing,
            "phase": phase_for(pid, missing),
        })

    rows.sort(key=lambda item: (item["priority"], item["name"].casefold(), item["id"]))
    for index, row in enumerate(rows):
        row["position"] = index + 1
        row["batch"] = index // BATCH_SIZE + 1
    return rows, manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, help="Mostra apenas um lote de até 15 perfis.")
    parser.add_argument("--json", action="store_true", help="Emite JSON legível por ferramentas.")
    args = parser.parse_args()

    rows, manifest = build_queue()
    selected = [row for row in rows if args.batch is None or row["batch"] == args.batch]
    batch_count = math.ceil(len(rows) / BATCH_SIZE) if rows else 0
    research = sum(row["phase"] == "research" for row in rows)
    audit = sum(row["phase"] == "audit" for row in rows)
    review = sum(row["phase"] == "review" for row in rows)

    payload = {
        "targetFemaleCount": manifest["target"]["targetFemaleCount"],
        "pending": len(rows),
        "research": research,
        "auditReady": audit,
        "inReview": review,
        "batches": batch_count,
        "batchSize": BATCH_SIZE,
        "items": selected,
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    print(
        f"female audit queue: {len(rows)} pending · {research} research · "
        f"{audit} audit-ready · {review} review · {batch_count} batches"
    )
    if args.batch is not None:
        print(f"batch {args.batch}/{batch_count}")
    print()
    for row in selected:
        missing = ",".join(row["missingAxes"]) if row["missingAxes"] else "-"
        print(
            f'{row["position"]:>3}  b{row["batch"]:02d}  {row["phase"]:<8} '
            f'{row["evidenceAxes"]:>2}/12  {row["source"]:<7} '
            f'{row["profileStatus"]:<11}  {row["id"]}  missing={missing}'
        )


if __name__ == "__main__":
    main()
