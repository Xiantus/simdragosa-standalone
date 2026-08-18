#!/usr/bin/env python3
"""gen_loot_map.py — Regenerate python/loot_map.py from live Raidbots static data.

The Droptimizer report only gives us item IDs, so worker.py needs a static
item-ID -> (source_name, source_type) table to label each upgrade with the raid
or dungeon it drops from.  Maintaining that by hand does not survive a patch,
so this script rebuilds it from the same static data the sim payload is built
from.

Usage (from the repo root, needs network access):

    python python/tools/gen_loot_map.py

Pass --seasons to control which virtual instance pools are included.  By
default both the current season and the previous one are emitted, so results
simmed before the patch still resolve to a source name.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import requests

RAIDBOTS_BASE = "https://www.raidbots.com"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
)

OUT_PATH = Path(__file__).resolve().parents[1] / "loot_map.py"

# Virtual instance pools to harvest, newest first.  A pool is the aggregate
# instance Raidbots exposes in the Droptimizer instance dropdown.
DEFAULT_POOLS = [-102, -1, -91]


def fetch_static() -> tuple[list, list]:
    """Return (encounter_items, instances) from the live static data bundle."""
    session = requests.Session()
    session.headers["User-Agent"] = UA

    page = session.get(RAIDBOTS_BASE + "/simbot/droptimizer", timeout=20)
    page.raise_for_status()
    m = re.search(r'"gameDataVersion"\s*:\s*"([a-f0-9]{32})"', page.text)
    if not m:
        sys.exit("Could not find gameDataVersion on the Droptimizer page.")
    data_hash = m.group(1)
    print(f"gameDataVersion: {data_hash}")

    def get(name: str):
        r = session.get(f"{RAIDBOTS_BASE}/static/data/{data_hash}/{name}", timeout=60)
        r.raise_for_status()
        return r.json()

    return get("encounter-items.json"), get("instances.json")


def build_map(
    encounter_items: list, instances: list, pools: list[int]
) -> dict[int, tuple[str, str]]:
    """Map item ID -> (instance name, "raid" | "dungeon") for the given pools."""
    by_id = {i["id"]: i for i in instances}

    # Which real instances does each pool cover?  For raid pools the aggregate
    # lists boss encounters that belong to real instances; for the M+ pool the
    # "encounters" are the dungeons themselves.
    real_ids: set[int] = set()
    for pool_id in pools:
        pool = by_id.get(pool_id)
        if pool is None:
            print(f"  warning: pool {pool_id} not present in instances.json — skipped")
            continue
        for enc in pool.get("encounters", []):
            enc_id = enc.get("id")
            if enc_id in by_id and by_id[enc_id].get("id", 0) > 0:
                real_ids.add(enc_id)            # M+ pool: encounter == dungeon
            else:
                for inst in instances:
                    if inst.get("id", 0) > 0 and any(
                        e.get("id") == enc_id for e in inst.get("encounters", [])
                    ):
                        real_ids.add(inst["id"])
                        break

    result: dict[int, tuple[str, str]] = {}
    for item in encounter_items:
        # Only weapons (2) and armour (4) can ever be a droptimizer upgrade.
        if item.get("itemClass") not in (2, 4):
            continue
        for src in item.get("sources", []):
            inst_id = src.get("instanceId")
            if inst_id not in real_ids:
                continue
            inst = by_id[inst_id]
            name = inst.get("name")
            kind = "raid" if inst.get("type") == "raid" else "dungeon"
            if name:
                result[item["id"]] = (name, kind)
            break
    return result


def load_existing(path: Path) -> dict[int, tuple[str, str]]:
    """Read the item map out of an existing loot_map.py, if there is one.

    Older seasons get dropped from Raidbots' static data once they rotate out,
    so anything we cannot regenerate is carried over verbatim — results simmed
    before the patch keep their source label.
    """
    if not path.exists():
        return {}
    namespace: dict = {}
    exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), namespace)
    return dict(namespace.get("ITEM_SOURCE", {}))


def render(mapping: dict[int, tuple[str, str]], pools: list[int]) -> str:
    """Render the mapping as the source of loot_map.py, grouped by source."""
    by_source: dict[tuple[str, str], list[int]] = {}
    for item_id, src in sorted(mapping.items()):
        by_source.setdefault(src, []).append(item_id)

    # Raids first, then dungeons; alphabetical within each group.
    ordered = sorted(by_source, key=lambda s: (s[1] != "raid", s[0]))

    lines = [
        "# loot_map.py",
        "# Static item-ID -> (source_name, source_type) mapping.",
        "#",
        "# GENERATED FILE — do not edit by hand.",
        "# Regenerate after a patch with:  python python/tools/gen_loot_map.py",
        f"# Instance pools: {', '.join(str(p) for p in pools)}",
        "#",
        "# Used by worker.py as the primary source label; parts[0] is the fallback.",
        "",
        "ITEM_SOURCE: dict[int, tuple[str, str]] = {",
    ]
    for name, kind in ordered:
        lines.append("")
        lines.append(f"    # --- {name} ({kind}) " + "-" * max(0, 60 - len(name) - len(kind)))
        for item_id in by_source[(name, kind)]:
            lines.append(f"    {item_id}: ({name!r}, {kind!r}),")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--pools",
        type=int,
        nargs="+",
        default=DEFAULT_POOLS,
        help="Virtual instance IDs to harvest (default: current + previous season).",
    )
    ap.add_argument("--out", type=Path, default=OUT_PATH)
    args = ap.parse_args()

    encounter_items, instances = fetch_static()
    mapping = build_map(encounter_items, instances, args.pools)
    if not mapping:
        sys.exit("No items resolved — refusing to overwrite loot_map.py.")
    print(f"Resolved {len(mapping)} items from live data.")

    carried = 0
    for item_id, src in load_existing(args.out).items():
        if item_id not in mapping:
            mapping[item_id] = src
            carried += 1
    if carried:
        print(f"Carried over {carried} items from rotated-out seasons.")

    args.out.write_text(render(mapping, args.pools), encoding="utf-8")
    print(f"Wrote {len(mapping)} items to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
