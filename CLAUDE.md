# Git Branching Workflow

## Branch Strategy

- **`master`** — production/release branch. Only receives merges from `develop`.
- **`develop`** — integration branch for local testing. All feature and fix branches merge here first.
- **Feature/fix branches** — branch off `develop`, merge back into `develop` when done.

## Rules

1. Never commit directly to `master`.
2. Create feature/fix branches from `develop`:
   ```
   git checkout develop
   git checkout -b feature/my-feature
   ```
3. Merge completed work into `develop` first:
   ```
   git checkout develop
   git merge feature/my-feature
   ```
4. To release, merge `develop` into `master`:
   ```
   git checkout master
   git merge develop
   git push
   ```

---

# Project Context (Wiki)

At session start, read these wiki pages for full project context:

- `C:\Users\Xiant\Documents\Projects\vault\Big Vault\wiki\sources\project-simdragosa-standalone.md` — architecture, v1 vs v2 comparison, key constraints
- `C:\Users\Xiant\Documents\Projects\vault\Big Vault\wiki\overviews\simdragosa-ecosystem.md` — how this project fits with auto_sim, addon, sds-lockfile

## Key facts (summary)

- v2 desktop app: Electron + React + TypeScript frontend; Python backend via subprocess with IPC bridge
- User workflow: add characters → select tracks → GO → view ranked DPS bars → `/reload` in WoW
- Writes `SimdragosaData.lua` to WoW addon folder; consumed by `simdragosa-addon`
- Distributed as Windows installer via GitHub Releases; auto-updater via electron-updater
- Python backend lives in `python/` subdirectory; **requires Python 3.10+ from python.org** (not Microsoft Store)
- Supersedes `sds-lockfile` (v1); shares core sim logic with `auto_sim`
- **Raidbots has no public API** — uses internal endpoints; session managed by `raidbots_session.py`

---

# Seasonal / Patch Updates

Everything that moves when Blizzard ships a new season lives in two places.

## 1. `python/payload_builder.py` — season config block

Update `SEASON_ID`, `SEASON_SHORT_NAME`, `SEASON_LABEL`, `ITEM_CONVERSION`,
`UPGRADE_TRACKS`, `VIRTUAL_INSTANCES`, and `RAID_INSTANCE_ID`.
`DIFFICULTY_MAP` is derived from those, so nothing else needs touching.

All the values come from Raidbots' own static data. Get the current data hash
from the Droptimizer page (`"gameDataVersion":"<hash>"`), then read:

| File | Gives you |
|---|---|
| `/static/data/<hash>/seasons.json` | season id, `shortName`, `bonusListGroups`, `itemConversionId` |
| `/static/data/<hash>/bonuses.json` | upgrade tracks — entries with an `upgrade` key, grouped by `upgrade.group` |
| `/static/data/<hash>/instances.json` | virtual pool IDs (e.g. `-102` Season 2 Raids) and the real raid/dungeon IDs |

The max-level `bonusId` of each group is the one to use — raids sim at 6/6.

## 2. `python/loot_map.py` — item → source labels

Generated, not hand-edited. After a patch:

```bash
python python/tools/gen_loot_map.py
```

It reads live static data and rewrites the file. Items from seasons that have
rotated out of Raidbots' data are carried over from the existing file so old
stored results keep their source label.

## Gotchas

- Raidbots' raid aggregate can lag behind a patch raid (this cost us Sporefall
  in 12.0.7). `VIRTUAL_INSTANCES` lists the real sub-instances so the missing
  encounters get unioned in.
- The M+ pool (`-1`) is a *different shape*: it lists each dungeon as one
  encounter whose id is the dungeon's instance id. Do not union its bosses in —
  every item would be simmed twice. `_build_droptimizer_items` guards this.
- `tests/test_season_config.py` pins the whole wiring. Run it first.
