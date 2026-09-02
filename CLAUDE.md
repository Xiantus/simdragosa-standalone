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

### Crafted gear (same block, different rules)

`CRAFTED_DIFFICULTY_MAP` covers the Epic Profession Items pool (`-88`). Crafted
items have no upgrade track: their item level is the base level of the reagent
that made them plus a crafting-quality offset, both expressed as bonus IDs.

| File | Gives you |
|---|---|
| `/static/data/<hash>/instances.json` | the `professionMidnight*` pools and their profession "encounters" |
| `/static/data/<hash>/crafting.json` | reagent slots → reagent item IDs (`craftingBonusIds`) |
| `/static/data/<hash>/bonus-id-base-levels.json` | bonus ID → `baseLevel` |
| `/static/data/<hash>/weapon-specs.json` | which specs can use which weapon type |

For each reagent, `baseLevel + qualityOffset` is the resulting item level
(R1 `9623` +0 … R5 `9627` +13), and `[reagentBonusIds…, qualityBonusId]` is
what goes in the item's bonus list. Cross-check against the Droptimizer
frontend, which names its crafted difficulties `professionMidnightEpic-<ilvl>`.
Only the max rank (R5) is simmed, and only the Epic pool — Rare and PVP
profession gear is never an upgrade for anyone who raids.

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
- Crafted gear carries **no `allowableClasses`** — every profession item is
  listed for every class. `_usable_by` filters by armour type and, for weapons,
  by `weapon-specs.json`, or a mage sims plate and warglaives.
- A crafted item ships with the base-level bonus of its lowest rank (`12214`
  for Season 2 epics). It has to be stripped before the track's own base-level
  bonus goes on, or Raidbots resolves two item levels for one item.
- Raidbots drops crafted items the character cannot actually gain from, so a
  crafted run sims fewer profilesets than we send. Verified on the first live
  run (40 sent, 20 simmed): every **embellished** item (bonus `8960`, item
  limit category 512) is dropped when the character already wears 2/2
  embellishments, and weapons whose main stat is wrong for the spec are
  dropped too. Both match what raidbots.com itself does — a character at the
  embellishment cap has to free a slot before crafted embellished gear can be
  compared.
- `tests/test_season_config.py` and `tests/test_crafted_config.py` pin the whole
  wiring. Run them first.

## Raidbots API notes

- Character data comes from `POST /api/character/load`, **not** the old
  `GET /wowapi/character/<region>/<realm>/<name>` (removed in 12.1 — it now
  returns 404 "Nothing here!" for every character). Only `/wowapi/.../image/...`
  survives.
- Send `source: "simc"` with the SimC string. `source: "armory"` additionally
  requires the character's armory profile to be complete and fails with
  `no_talents` when it is not.
- `locale` must be exactly `en_US`. `en_GB` is rejected with HTTP 422
  `{"error":"Invalid locale"}` even for EU characters.
- The response envelope is `{profile, gearOptions, equippedItems, bags,
  profileCacheId, warnings}`. The sim payload sends `profile` as its
  `character` field and `profileCacheId` alongside it.
- Equipment is split across two objects: `equippedItems` has the rich item data
  (inventoryType, itemLevel, stats), `profile.equipped` has enchant_id/gem_id/
  bonusLists. `merge_equipped()` overlays them. Weapon slots are camelCase in
  `profile.equipped` (`mainHand`) and snake_case everywhere else.
- Talents must be submitted explicitly now — `talents` and `activeLoadout` both
  take the active loadout's `string`. Omitting them fails with `no_talents`.
- `frontendVersion` is a fixed literal in Raidbots' frontend; the hashed JS
  bundle name goes in `frontendJsHash`, and `gameDataVersion` is sent too.
