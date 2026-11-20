#!/usr/bin/env python3
"""Export recorded ReTRACE-27B-latest planning sessions for the /retrace/ console.

Reads the frozen S3 Test40 snapshot (result + transcript per target) and the
frozen two-stage audit ledger, and writes one allowlisted JSON file. Only
route-level facts and tool-call metadata leave the archive: no model reasoning,
no prompts, no internal paths or endpoints.

Run with an interpreter that has RDKit, e.g.

  /path/to/retrace/agent/.venv/bin/python scripts/retrace/export_sessions.py \
      --archive /path/to/Test40-Final-Snapshot-v2 \
      --campaign /path/to/campaign-s3/campaign.json \
      --idx 171 89 136 13 99 \
      --out assets/data/retrace-sessions-v1.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

from rdkit import Chem, RDLogger
from rdkit.Chem import rdDepictor, rdFMCS
from rdkit.Chem.Draw import rdMolDraw2D

RDLogger.DisableLog("rdApp.*")
rdDepictor.SetPreferCoordGen(True)

ENGINE_NAMES = {
    "graph_retrosyn": "GraphRetroSyn",
    "rxngraphormer": "RXNGraphormer",
    "chembart": "ChemBART",
    "pistachio_ringbreaker": "Ringbreaker",
}
CST = timezone(timedelta(hours=8))


def canon(smi: str) -> str:
    m = Chem.MolFromSmiles(smi)
    return Chem.MolToSmiles(m) if m is not None else smi


def canon_set(smis) -> tuple:
    out = []
    for s in smis:
        for part in s.split("."):
            if part:
                out.append(canon(part))
    return tuple(sorted(out))


def depict(target: str, smiles_list) -> dict:
    """ACS 1996-style SVG per structure, laid out to match the target.

    Every drawing uses the same bond length, so the page can place them at
    one scale. Intermediates that share a ring system with the target keep
    the target's orientation, which makes the change at each step easy to see.
    """
    ref = Chem.MolFromSmiles(target)
    rdDepictor.Compute2DCoords(ref)
    out = {}
    for smi in dict.fromkeys(smiles_list):
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            continue
        aligned = False
        if smi != target and mol.GetNumHeavyAtoms() >= 8:
            mcs = rdFMCS.FindMCS([ref, mol], timeout=4, ringMatchesRingOnly=True, completeRingsOnly=True)
            if mcs.numAtoms >= 8:
                patt = Chem.MolFromSmarts(mcs.smartsString)
                try:
                    rdDepictor.GenerateDepictionMatching2DStructure(mol, ref, refPatt=patt, acceptFailure=True)
                    aligned = True
                except Exception:
                    aligned = False
        if smi == target:
            mol = ref
        elif not aligned:
            rdDepictor.Compute2DCoords(mol)
        d = rdMolDraw2D.MolDraw2DSVG(-1, -1)
        o = d.drawOptions()
        rdMolDraw2D.SetACS1996Mode(o, rdMolDraw2D.MeanBondLength(mol) or 1.5)
        # ACS 1996 proportions, with atom labels raised from 10 pt to 12 pt so
        # they stay above 5 pt when the page is reproduced at figure width.
        o.fixedFontSize = 12
        o.clearBackground = False
        o.padding = 0.06
        o.addStereoAnnotation = False
        d.DrawMolecule(mol)
        d.FinishDrawing()
        svg = d.GetDrawingText()
        svg = "\n".join(l for l in svg.splitlines() if not l.startswith("<?xml") and "<!--" not in l)
        out[smi] = svg
    return out


def strip_step(s: str) -> tuple[str, str | None]:
    m = re.search(r"\s*\(reaction:\s*(.*?)\)\s*$", s)
    if m:
        return s[: m.start()].strip(), m.group(1).strip()
    return s.strip(), None


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def as_obj(v):
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return v
    return v


def build_session(idx: int, snap: Path, audit_rec: dict | None) -> dict:
    res = json.loads((snap / "result.json").read_text())
    tr = json.loads((snap / "transcript.json").read_text())
    events = tr["events"]
    stats = tr["stats"]
    target = res["smiles"]

    # ---- tool evidence -------------------------------------------------
    engine_support: dict[tuple, set] = {}
    template_support: dict[tuple, set] = {}
    stock: dict[str, list] = {}
    score_by_key: dict[frozenset, dict] = {}
    annotations: dict[str, str] = {}
    timeline = []
    calls = {e["tool_call_id"]: e for e in events if e.get("event") == "tool_call"}
    iteration = 0
    for e in events:
        ev = e.get("event")
        if ev == "iteration":
            iteration = int(e["n"])
            continue
        if ev == "tool_call" and e["name"] == "save_best_route":
            args = as_obj(e["arguments"])
            for s in args.get("steps", []) if isinstance(args, dict) else []:
                raw, ann = strip_step(s)
                if ann:
                    annotations[raw] = ann
        if ev != "tool_result":
            continue
        name = e["name"]
        args = as_obj(e.get("arguments")) or {}
        r = as_obj(e.get("result")) or {}
        note = ""
        if name == "neural_retro" and isinstance(r, dict):
            prod = canon(r.get("target") or args.get("target_smiles", ""))
            for p in r.get("predictions", []) or []:
                key = (prod, canon_set([p["reactants"]]))
                engine_support.setdefault(key, set()).update(p.get("support") or [])
            per = ((r.get("_detail") or {}).get("per_engine_predictions") or {})
            for eng, preds in per.items():
                for p in preds or []:
                    key = (prod, canon_set([p["reactants"]]))
                    engine_support.setdefault(key, set()).add(eng)
            n_eng = sum(1 for v in (r.get("per_engine_counts") or {}).values() if v)
            note = f"{r.get('n_unique_after_dedup', 0)} candidates from {n_eng} engines"
        elif name == "suggest_templates" and isinstance(r, dict):
            prod = canon(r.get("product") or args.get("product_smiles", ""))
            for s in r.get("suggestions", []) or []:
                key = (prod, canon_set(s.get("reactants") or [s.get("reactants_smiles", "")]))
                template_support.setdefault(key, set()).add(s.get("template_source", "template"))
            note = f"{r.get('num_suggestions', 0)} templates from {r.get('library_size', 0):,}"
        elif name == "check_buyability" and isinstance(r, dict):
            for x in r.get("results", []) or []:
                stock[canon(x.get("smiles") or x.get("input_smiles"))] = [
                    s.replace("-stock", "").replace("_Fix", "") for s in (x.get("found_in_stocks") or [])
                ]
            note = f"{r.get('n_buyable', 0)} of {r.get('n', r.get('count', 0))} purchasable"
        elif name == "score_route" and isinstance(r, dict):
            steps = as_obj(args.get("route_steps")) or []
            key = frozenset((canon(s["product"]), canon_set(s["reactants"])) for s in steps if isinstance(s, dict))
            score_by_key[key] = {"steps": steps, "result": r}
            note = f"score {r.get('total_score')}"
        elif name == "save_best_route" and isinstance(r, dict):
            saved = r.get("saved") or {}
            note = f"saved {saved.get('label', '')}"
        elif name == "explore_branches" and isinstance(r, dict):
            note = f"{r.get('num_branches_evaluated', 0)} branches ranked"
        elif name == "validate_smiles" and isinstance(r, dict):
            note = "valid" if r.get("valid") else "invalid"
        elif name == "analyze_molecule" and isinstance(r, dict):
            note = f"MW {r.get('mw')} · SA {r.get('sa_score')}"
        elif name == "list_best_routes" and isinstance(r, dict):
            note = f"{r.get('count', 0)} routes in memory"
        timeline.append({
            "iter": iteration,
            "tool": name,
            "ms": int(float(e.get("elapsed_ms") or 0)),
            "note": note,
        })

    # ---- routes ----------------------------------------------------------
    routes = []
    for rank, r in enumerate(res["all_routes"], start=1):
        parsed = []
        for s in r["steps"]:
            raw, ann = strip_step(s)
            prod, reac = raw.split(">>")
            parsed.append({
                "raw": raw,
                "product": prod,
                "precursors": [x for x in reac.split(".") if x],
                "reaction": ann or annotations.get(raw),
            })
        cprod = [canon(p["product"]) for p in parsed]
        root = next((k for k, c in enumerate(cprod) if c == canon(target)), len(parsed) - 1)
        key = frozenset((canon(p["product"]), canon_set(p["precursors"])) for p in parsed)
        sc = score_by_key.get(key)
        per_step_feas = {}
        green = {}
        if sc:
            order = [(canon(s["product"]), canon_set(s["reactants"])) for s in sc["steps"]]
            det = sc["result"].get("_detail") or {}
            fs = (det.get("feasibility") or {}).get("per_step") or []
            gs = (det.get("greenness") or {}).get("per_step") or []
            for k, okey in enumerate(order):
                f = next((x for x in fs if x.get("step") == k), None)
                g = next((x for x in gs if x.get("step") == k), None)
                per_step_feas[okey] = f.get("final_score") if f else None
                green[okey] = g
        audit_steps = {}
        audit = None
        if rank == 1 and audit_rec:
            for st in audit_rec["steps"]:
                audit_steps[int(st["step_index"])] = {
                    "verdict": st["verdict"], "defect": st["defect_code"], "reason": st["reason"],
                }
            audit = {
                "verdict": audit_rec["route_verdict"],
                "passed": audit_rec["route_verdict"] != "FAKE",
                "worst_defect": audit_rec["worst_defect"],
                "n_fatal_steps": int(audit_rec["n_fake_steps"]),
                "n_suspect_steps": int(audit_rec["n_suspect_steps"]),
                "summary": audit_rec["summary"],
                "stage2": {
                    "triggered": bool(audit_rec.get("adv_triggered")),
                    "upheld": audit_rec.get("adv_upheld"),
                    "reason": audit_rec.get("adv_reason"),
                },
            }
        steps = []
        for k, p in enumerate(parsed):
            okey = (canon(p["product"]), canon_set(p["precursors"]))
            engines = sorted(engine_support.get(okey, set()))
            tmpl = sorted(template_support.get(okey, set()))
            g = green.get(okey) or {}
            steps.append({
                "index": k,
                "product": p["product"],
                "precursors": p["precursors"],
                "precursor_steps": [
                    [j for j, c in enumerate(cprod) if c == canon(x) and j != k] for x in p["precursors"]
                ],
                "reaction": p["reaction"],
                "feasibility": per_step_feas.get(okey),
                "engines": [ENGINE_NAMES.get(x, x) for x in engines],
                "templates": tmpl[:3],
                "solvent": (g.get("solvent") or {}).get("name") if g else None,
                "hazards": [h.get("name") for h in (g.get("hazardous_reagents") or [])] if g else [],
                "audit": audit_steps.get(k),
            })
        sub = r.get("sub_scores") or {}
        leaves = []
        for sm in r.get("starting_materials") or []:
            leaves.append({"smiles": sm, "stock": stock.get(canon(sm), [])})
        routes.append({
            "rank": rank,
            "label": r["label"],
            "notes": r.get("notes") or "",
            "provenance": r.get("provenance"),
            "root_step": root,
            "scores": {
                "total": r.get("total_score"),
                "feasibility": sub.get("feasibility_score"),
                "cost": sub.get("cost_score"),
                "greenness": sub.get("greenness_score"),
                "buyable": sub.get("buyable_leaf_fraction"),
            },
            "leaves": leaves,
            "steps": steps,
            "audit": audit,
        })

    started = datetime.strptime(res["started_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    return {
        "id": f"R190-{idx:03d}",
        "label": f"Retro*-190 #{idx}",
        "target": target,
        "model": "ReTRACE-27B-latest",
        "version": "s3-v1",
        "preset": "standard",
        "weights": {"feasibility": 0.7, "cost": 0.15, "greenness": 0.15},
        "started": started.astimezone(CST).strftime("%Y-%m-%d %H:%M"),
        "wall_s": round(float(res["wall_seconds"])),
        "iterations": stats["n_iterations"],
        "tool_calls": stats["n_tool_calls"],
        "tool_counts": stats["tool_call_counts"],
        "tool_ms": stats["tool_elapsed_ms_by_name"],
        "timeline": timeline,
        "routes": routes,
        "structures": depict(target, [target] + [
            x for r in routes for st in r["steps"] for x in [st["product"]] + st["precursors"]
        ]),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--archive", required=True, type=Path)
    ap.add_argument("--campaign", required=True, type=Path)
    ap.add_argument("--idx", required=True, type=int, nargs="+")
    ap.add_argument("--out", required=True, type=Path)
    a = ap.parse_args()
    accepted = json.loads((a.archive / "accepted40_v2.json").read_text())
    acc = {int(x["idx"]): x for x in accepted["accepted"]}
    camp = json.loads(a.campaign.expanduser().read_text())
    audits = {int(r["idx"]): r for r in camp["records"] if int(r.get("rank", 1)) == 1}
    sessions, sources = [], []
    for idx in a.idx:
        snap = a.archive / "snapshots" / f"{idx:03d}"
        rec = acc[idx]
        for kind in ("result", "transcript"):
            got = sha(snap / f"{kind}.json")
            if got != rec[kind]["sha256"]:
                raise SystemExit(f"{idx} {kind} hash mismatch")
        sessions.append(build_session(idx, snap, audits.get(idx)))
        sources.append({"idx": idx, "result_sha256": rec["result"]["sha256"],
                        "transcript_sha256": rec["transcript"]["sha256"]})
    out = {
        "schema": "retrace-sessions/1",
        "source": "ReTRACE-27B-latest (s3-v1) sessions on Retro*-190 targets, scored by the in-search route evaluator; rank-1 routes judged by the frozen two-stage audit",
        "audit_rule": "route passes unless its final audit verdict is FAKE",
        "campaign_sha256": sha(a.campaign.expanduser()),
        "inputs": sources,
        "sessions": sessions,
    }
    a.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(a.out, a.out.stat().st_size)


if __name__ == "__main__":
    main()
