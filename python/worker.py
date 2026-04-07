#!/usr/bin/env python3
"""worker.py — Stateless sim worker for Simdragosa v2.

Reads one JSON job spec from stdin, runs the simulation using the existing
droptimizer/sim_router/qe_sim modules, and emits line-delimited JSON
progress events to stdout throughout execution.

Input (one JSON line on stdin):
  {"type": "raidbots", "job_id": "...", "character": {...}, "difficulty": "...",
   "build_label": "...", "talent_code": "...", "raidsid": "...",
   "raidbots_api_key": null, "timeout_minutes": 30}

Output (line-delimited JSON to stdout):
  {"type": "progress", "status": "fetching"}
  {"type": "progress", "status": "submitting", "sim_id": "..."}
  {"type": "progress", "status": "running", "sim_id": "..."}
  {"type": "done", "url": "...", "dps_gains": [...]}
  {"type": "error", "message": "..."}
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Callable

# Configure logging to stderr only (stdout is reserved for JSON protocol)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def _emit(event: dict, emit_fn: Callable | None = None) -> None:
    """Write a JSON event to stdout (or call emit_fn for testing)."""
    if emit_fn is not None:
        emit_fn(event)
    else:
        print(json.dumps(event), flush=True)


# ---------------------------------------------------------------------------
# Tooltip data parsing (extracted from app.py _parse_tooltip_data)
# ---------------------------------------------------------------------------

def _parse_tooltip_data(report_json: dict) -> list[dict]:
    """Extract item upgrade entries from a Raidbots Droptimizer report JSON."""
    try:
        players = report_json.get("sim", {}).get("players", [])
        if not players:
            return []
        base_dps = players[0].get("collected_data", {}).get("dps", {}).get("mean")
        if base_dps is None:
            return []
        results = report_json.get("sim", {}).get("profilesets", {}).get("results", [])
        if not results:
            return []
        best: dict[int, dict] = {}
        for row in results:
            name_str = row.get("name", "")
            mean_dps = row.get("mean")
            if mean_dps is None:
                continue
            parts = name_str.split("/")
            if len(parts) < 5:
                continue
            try:
                item_id = int(parts[3])
                ilvl = int(parts[4]) if parts[4] else None
            except (ValueError, TypeError):
                continue
            dps_gain = round(mean_dps - base_dps, 1)
            if dps_gain <= 0:
                continue
            existing = best.get(item_id)
            if existing is None or dps_gain > existing["dps_gain"]:
                best[item_id] = {
                    "item_id": item_id,
                    "dps_gain": dps_gain,
                    "ilvl": ilvl,
                    "item_name": None,
                }
        return list(best.values())
    except Exception as exc:
        log.warning("tooltip parse error: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Raidbots job runner
# ---------------------------------------------------------------------------

def run_raidbots_job(spec: dict, emit_fn: Callable | None = None) -> int:
    """Run a Raidbots Droptimizer sim job. Returns 0 on success, 1 on error."""
    from droptimizer import (
        RAIDBOTS_BASE, apply_talent, fetch_character, fetch_static_data,
    )
    from payload_builder import CharacterIdentity, SimTarget, DIFFICULTY_MAP, build_payload
    from raidbots_session import make_raidbots_session
    from sim_router import run_raidbots_sim

    job_id = spec.get("job_id", "unknown")
    char = spec["character"]
    difficulty = spec.get("difficulty", "raid-heroic")
    talent_code = spec.get("talent_code")
    raidsid = spec.get("raidsid", "")
    api_key = spec.get("raidbots_api_key")
    timeout_minutes = spec.get("timeout_minutes", 30)

    try:
        _emit({"type": "progress", "status": "fetching"}, emit_fn)

        session = make_raidbots_session(raidsid)

        character_data = fetch_character(
            session, char["region"], char["realm"], char["name"]
        )
        static = fetch_static_data(session)

        # Apply talent override if provided
        simc = char["simc_string"]
        if talent_code:
            simc = apply_talent(simc, talent_code)

        spec_name = char.get("spec", "Fire").capitalize()
        diff_cfg = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["raid-heroic"])

        identity = CharacterIdentity(
            name=char["name"],
            realm=char["realm"],
            region=char["region"],
            spec_label=spec_name,
            simc_string=simc,
        )
        target = SimTarget(
            difficulty=difficulty,
            instance_id=diff_cfg["instance_id"],
            fight_style=diff_cfg["fight_style"],
            spec_id=char.get("spec_id", 63),
            loot_spec_id=char.get("loot_spec_id", char.get("spec_id", 63)),
            crafted_stats=char.get("crafted_stats", "36/49"),
        )

        _emit({"type": "progress", "status": "submitting"}, emit_fn)

        submitted_sim_id: list[str] = []

        def _on_submitted(sim_id: str) -> None:
            submitted_sim_id.append(sim_id)
            _emit({"type": "progress", "status": "running", "sim_id": sim_id}, emit_fn)

        result = run_raidbots_sim(
            session, identity, target, character_data, static,
            timeout_minutes=timeout_minutes,
            on_submitted=_on_submitted,
        )

        if not result.ok:
            _emit({"type": "error", "message": result.error or "Sim failed or timed out"}, emit_fn)
            return 1

        # Fetch report data and parse DPS gains
        sim_id = result.url.rstrip("/").split("/")[-1]
        dps_gains: list[dict] = []
        try:
            import requests as _requests
            data_url = f"{RAIDBOTS_BASE}/simbot/report/{sim_id}/data.json"
            resp = session.get(data_url, timeout=30)
            if resp.ok:
                dps_gains = _parse_tooltip_data(resp.json())
        except Exception as exc:
            log.warning("Could not fetch/parse report data: %s", exc)

        _emit({"type": "done", "url": result.url, "dps_gains": dps_gains}, emit_fn)
        return 0

    except Exception as exc:
        log.exception("Raidbots job failed with unhandled exception")
        _emit({"type": "error", "message": str(exc)}, emit_fn)
        return 1


# ---------------------------------------------------------------------------
# QE (healer) job runner
# ---------------------------------------------------------------------------

def run_qe_job(spec: dict, emit_fn: Callable | None = None) -> int:
    """Run a QuestionablyEpic healer sim job. Returns 0 on success, 1 on error."""
    from sim_router import run_qe_sim

    char = spec["character"]
    timeout_minutes = spec.get("timeout_minutes", 10)
    simc = char["simc_string"]
    spec_id = char.get("spec_id", 0)

    try:
        _emit({"type": "progress", "status": "running"}, emit_fn)
        result = run_qe_sim(simc, spec_id=spec_id, timeout_minutes=timeout_minutes)
        if result.ok:
            _emit({"type": "done", "url": result.url, "dps_gains": []}, emit_fn)
            return 0
        else:
            _emit({"type": "error", "message": result.error or "QE sim failed"}, emit_fn)
            return 1
    except Exception as exc:
        log.exception("QE job failed with unhandled exception")
        _emit({"type": "error", "message": str(exc)}, emit_fn)
        return 1


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    try:
        raw = sys.stdin.readline()
        if not raw or not raw.strip():
            _emit({"type": "error", "message": "Empty or missing stdin input"})
            return 1
        spec = json.loads(raw)
    except json.JSONDecodeError as exc:
        _emit({"type": "error", "message": f"Invalid JSON on stdin: {exc}"})
        return 1
    except Exception as exc:
        _emit({"type": "error", "message": f"Failed to read stdin: {exc}"})
        return 1

    job_type = spec.get("type", "raidbots")

    if job_type == "raidbots":
        return run_raidbots_job(spec)
    elif job_type == "qe":
        return run_qe_job(spec)
    else:
        _emit({"type": "error", "message": f"Unknown job type: {job_type!r}"})
        return 1


if __name__ == "__main__":
    sys.exit(main())
