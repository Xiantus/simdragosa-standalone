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

import io
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

def _parse_simc_spec(simc_string: str) -> tuple[str, int]:
    """Extract the WoW spec display name and spec_id from a SimC profile string.

    Parses the ``classname="..."`` and ``spec=...`` lines to resolve the real
    spec, including TWW hero-talent aliases like ``devourer`` (Havoc DH) so
    the Raidbots payload always has a valid class+spec combination.

    Returns:
        (display_name, spec_id) — e.g. ("Havoc", 577)
        Falls back to ("Unknown", 0) if the spec line is missing or unrecognised.
    """
    # (simc_class_token, spec_token) → (display_name, spec_id)
    _SPEC_MAP: dict[tuple[str, str], tuple[str, int]] = {
        ("warrior",      "arms"):           ("Arms",          71),
        ("warrior",      "fury"):           ("Fury",          72),
        ("warrior",      "protection"):     ("Protection",    73),
        ("paladin",      "holy"):           ("Holy",          65),
        ("paladin",      "protection"):     ("Protection",    66),
        ("paladin",      "retribution"):    ("Retribution",   70),
        ("hunter",       "beast_mastery"):  ("Beast Mastery", 253),
        ("hunter",       "marksmanship"):   ("Marksmanship",  254),
        ("hunter",       "survival"):       ("Survival",      255),
        ("rogue",        "assassination"):  ("Assassination", 259),
        ("rogue",        "outlaw"):         ("Outlaw",        260),
        ("rogue",        "subtlety"):       ("Subtlety",      261),
        ("priest",       "discipline"):     ("Discipline",    256),
        ("priest",       "holy"):           ("Holy",          257),
        ("priest",       "shadow"):         ("Shadow",        258),
        ("shaman",       "elemental"):      ("Elemental",     262),
        ("shaman",       "enhancement"):    ("Enhancement",   263),
        ("shaman",       "restoration"):    ("Restoration",   264),
        ("mage",         "arcane"):         ("Arcane",        62),
        ("mage",         "fire"):           ("Fire",          63),
        ("mage",         "frost"):          ("Frost",         64),
        ("warlock",      "affliction"):     ("Affliction",    265),
        ("warlock",      "demonology"):     ("Demonology",    266),
        ("warlock",      "destruction"):    ("Destruction",   267),
        ("monk",         "brewmaster"):     ("Brewmaster",    268),
        ("monk",         "windwalker"):     ("Windwalker",    269),
        ("monk",         "mistweaver"):     ("Mistweaver",    270),
        ("druid",        "balance"):        ("Balance",       102),
        ("druid",        "feral"):          ("Feral",         103),
        ("druid",        "guardian"):       ("Guardian",      104),
        ("druid",        "restoration"):    ("Restoration",   105),
        ("demonhunter",  "havoc"):          ("Havoc",         577),
        ("demonhunter",  "vengeance"):      ("Vengeance",     581),
        # TWW standalone DH specs (separate spec IDs, not hero-talent aliases)
        ("demonhunter",  "devourer"):       ("Devourer",      1480),
        ("deathknight",  "blood"):          ("Blood",         250),
        ("deathknight",  "frost"):          ("Frost",         251),
        ("deathknight",  "unholy"):         ("Unholy",        252),
        ("evoker",       "devastation"):    ("Devastation",   1467),
        ("evoker",       "preservation"):   ("Preservation",  1468),
        ("evoker",       "augmentation"):   ("Augmentation",  1473),
    }

    # Known SimC class tokens (the word before ="name" in the profile)
    _CLASS_TOKENS = {
        "warrior", "paladin", "hunter", "rogue", "priest", "shaman",
        "mage", "warlock", "monk", "druid", "demonhunter", "deathknight",
        "deathknight", "evoker",
    }

    simc_class = None
    simc_spec  = None

    for raw_line in simc_string.splitlines():
        line = raw_line.strip().lower()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, _ = line.partition("=")
            key = key.strip()
            if key in _CLASS_TOKENS:
                simc_class = key
            elif key == "spec":
                simc_spec = line.partition("=")[2].strip()

    if simc_class and simc_spec:
        result = _SPEC_MAP.get((simc_class, simc_spec))
        if result:
            return result
        # Unknown spec — return capitalised form with 0 id
        return simc_spec.replace("_", " ").title(), 0

    return "Unknown", 0


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
            zone_name = parts[1].strip() if len(parts) > 1 else ""
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
                    "zone_name": zone_name,
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

        diff_cfg = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["raid-heroic"])

        # Auto-detect spec from the simc_string so the payload class/spec always
        # matches, even when the character was registered with the wrong spec_id.
        simc_spec_name, simc_spec_id = _parse_simc_spec(simc)
        stored_spec_id = char.get("spec_id", 63)

        if simc_spec_id and simc_spec_id != stored_spec_id:
            log.info(
                "Overriding stored spec_id %d with simc-derived spec %s (%d)",
                stored_spec_id, simc_spec_name, simc_spec_id,
            )
            effective_spec_id   = simc_spec_id
            effective_spec_name = simc_spec_name
        else:
            effective_spec_id   = stored_spec_id
            effective_spec_name = simc_spec_name or char.get("spec", "Unknown").capitalize()

        identity = CharacterIdentity(
            name=char["name"],
            realm=char["realm"],
            region=char["region"],
            spec_label=effective_spec_name,
            simc_string=simc,
        )
        target = SimTarget(
            difficulty=difficulty,
            instance_id=diff_cfg["instance_id"],
            fight_style=diff_cfg["fight_style"],
            spec_id=effective_spec_id,
            loot_spec_id=char.get("loot_spec_id", effective_spec_id),
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
    # Force UTF-8 on stdin/stdout so non-ASCII character names (e.g. "Jüther")
    # are not mangled on Windows where the default console encoding is cp1252.
    if sys.stdin and isinstance(sys.stdin, io.TextIOWrapper):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
    if sys.stdout and isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

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


# ---------------------------------------------------------------------------
# Playwright install / check helpers (used in packaged app via CLI args)
# ---------------------------------------------------------------------------

def _playwright_driver():
    """Return (cmd_list, env) for running the playwright driver, or raise RuntimeError."""
    import glob
    import pathlib
    from playwright._impl._driver import get_driver_env  # type: ignore

    env = get_driver_env()
    driver_path: pathlib.Path | None = None

    # 1. Try standard path computation (works in normal Python installs).
    try:
        from playwright._impl._driver import compute_driver_executable  # type: ignore
        candidate = pathlib.Path(compute_driver_executable())
        if candidate.exists():
            driver_path = candidate
    except Exception:
        pass

    # 2. When running inside a PyInstaller bundle the PYZ archive means
    #    __file__ doesn't point to a real directory, so compute_driver_executable
    #    returns a path that doesn't exist.  Search _MEIPASS broadly instead.
    if driver_path is None and hasattr(sys, "_MEIPASS"):
        meipass = pathlib.Path(sys._MEIPASS)  # type: ignore[attr-defined]
        # Try the expected location first (fast path)
        for name in ("playwright.exe", "playwright.cmd", "playwright"):
            candidate = meipass / "playwright" / "driver" / name
            if candidate.exists():
                driver_path = candidate
                break
        # If not found there, do a full recursive glob across _MEIPASS
        if driver_path is None:
            log.info("[playwright] Fast path miss — scanning %s for playwright driver", meipass)
            for pattern in ("playwright.exe", "playwright.cmd"):
                matches = glob.glob(str(meipass / "**" / pattern), recursive=True)
                if matches:
                    # Prefer the one closest to a 'driver' directory
                    matches.sort(key=lambda p: ("driver" not in p.lower(), len(p)))
                    driver_path = pathlib.Path(matches[0])
                    log.info("[playwright] Found driver via glob: %s", driver_path)
                    break

    if driver_path is None:
        meipass_str = str(getattr(sys, "_MEIPASS", "(no _MEIPASS)"))
        raise RuntimeError(
            f"Playwright driver executable not found.\n"
            f"Searched: standard path via compute_driver_executable(), "
            f"and glob scan of {meipass_str}.\n"
            f"playwright package location: "
            f"{pathlib.Path(__import__('playwright').__file__).parent}"
        )

    # .cmd batch files must be invoked via cmd.exe /c on Windows.
    if sys.platform == "win32" and driver_path.suffix.lower() == ".cmd":
        cmd = ["cmd", "/c", str(driver_path)]
    else:
        cmd = [str(driver_path)]

    log.info("[playwright] Using driver: %s", driver_path)
    return cmd, env


def install_playwright_main() -> int:
    """Download Playwright Chromium. Emits JSON progress events to stdout."""
    import subprocess
    import re
    try:
        driver_cmd, env = _playwright_driver()
    except Exception as exc:
        print(json.dumps({"type": "error", "message": f"Playwright driver not available: {exc}"}), flush=True)
        return 1

    try:
        print(json.dumps({"type": "progress", "percent": 5, "message": "Starting Chromium download…"}), flush=True)
        proc = subprocess.Popen(
            driver_cmd + ["install", "chromium"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        assert proc.stdout is not None
        percent = 5
        for line in iter(proc.stdout.readline, ""):
            line = line.strip()
            if not line:
                continue
            m = re.search(r"(\d+)%", line)
            if m:
                inner = int(m.group(1))
                percent = 5 + round(inner * 0.9)
            else:
                percent = min(percent + 1, 94)
            print(json.dumps({"type": "progress", "percent": percent, "message": line}), flush=True)
        proc.wait()
        if proc.returncode == 0:
            print(json.dumps({"type": "done", "percent": 100, "message": "Chromium installed successfully."}), flush=True)
            return 0
        else:
            print(json.dumps({"type": "error", "message": f"Driver exited with code {proc.returncode}"}), flush=True)
            return 1
    except Exception as exc:
        print(json.dumps({"type": "error", "message": str(exc)}), flush=True)
        return 1


def check_playwright_main() -> int:
    """Exit 0 if Playwright Chromium is already installed, 1 otherwise."""
    import subprocess
    try:
        driver_cmd, env = _playwright_driver()
        result = subprocess.run(
            driver_cmd + ["install", "--dry-run", "chromium"],
            capture_output=True,
            env=env,
            timeout=15,
        )
        return 0 if result.returncode == 0 else 1
    except Exception:
        return 1


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--install-playwright":
        sys.exit(install_playwright_main())
    if len(sys.argv) > 1 and sys.argv[1] == "--check-playwright":
        sys.exit(check_playwright_main())
    sys.exit(main())
