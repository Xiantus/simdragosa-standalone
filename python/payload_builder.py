"""payload_builder.py — Pure Raidbots Droptimizer payload construction.

All functions here are pure (no network I/O, no file I/O).  The only runtime
dependency is the standard library plus the dataclasses already on ``sys.path``.
This makes the module trivially testable with fixture data captured once from
live Raidbots responses.

Typical usage
-------------
::

    from payload_builder import (
        CharacterIdentity, SimTarget, StaticData, build_payload,
    )
    from droptimizer import fetch_static_data

    static   = fetch_static_data(session)
    identity = CharacterIdentity(
        name="Xiantus", realm="illidan", region="us",
        spec_label="Fire", simc_string=simc,
    )
    target = SimTarget(
        difficulty="raid-heroic", instance_id=-102,
        spec_id=63, loot_spec_id=63,
    )
    payload = build_payload(identity, target, character_data, static)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from itertools import combinations
from typing import Any

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Season configuration
# ---------------------------------------------------------------------------
#
# Everything that moves when Blizzard ships a new season/patch lives in this one
# block.  Values are taken from Raidbots' own static data, so they can always be
# re-derived rather than guessed:
#
#   season id / shortName / bonusListGroups / itemConversionId
#       -> /static/data/<gameDataVersion>/seasons.json
#   upgrade track bonus IDs (group -> level -> bonusId)
#       -> /static/data/<gameDataVersion>/bonuses.json  (entries with "upgrade")
#   virtual + real instance IDs
#       -> /static/data/<gameDataVersion>/instances.json
#
# Current: Midnight Season 2 (patch 12.1) — season 37, "mid2".
# Tracks are groups 614-618: Adventurer, Veteran, Champion, Hero, Myth.
# Season 1 was season 34 / "mid1" / groups 607-612 and has rotated out of
# Raidbots' bonus data entirely, so its bonus IDs no longer resolve.

SEASON_ID:         int = 37
SEASON_SHORT_NAME: str = "mid2"
SEASON_LABEL:      str = "Season 2"

# Raidbots' frontend sends this as a fixed literal, separate from the hashed
# JS bundle name (which now goes in frontendJsHash).
RAIDBOTS_FRONTEND_VERSION: str = "c3efae61cb2aa1649cd6711ca78c0f74b61aaf89"

# Raidbots removes a season's item-conversion floor from static data, so the
# minLevel below is carried over from Season 1.  It is a lower bound only —
# every Season 2 track starts well above it — so it stays permissive.
ITEM_CONVERSION: dict[str, int] = {"id": 13, "minLevel": 220}

# Upgrade track → (bonusListGroup, max-level bonusId, max level, ilvl at max).
UPGRADE_TRACKS: dict[str, dict[str, int]] = {
    "Adventurer": {"group": 614, "bonusId": 12822, "level": 6, "max": 6, "itemLevel": 282},
    "Veteran":    {"group": 615, "bonusId": 12830, "level": 6, "max": 6, "itemLevel": 295},
    "Champion":   {"group": 616, "bonusId": 12838, "level": 6, "max": 6, "itemLevel": 308},
    "Hero":       {"group": 617, "bonusId": 12846, "level": 6, "max": 6, "itemLevel": 321},
    "Myth":       {"group": 618, "bonusId": 12854, "level": 6, "max": 6, "itemLevel": 334},
}

# Virtual instance ID → real instance IDs it aggregates.
# -102 = Midnight Season 2 Raids
#        (The Venomous Abyss 1320 · The Tidebound Grotto 1317)
# -1   = Midnight Season 2 M+ pool (8 dungeons)
#
# Raidbots' own aggregate encounter list can lag behind a patch raid (this cost
# us Sporefall in 12.0.7), so _build_droptimizer_items unions these sub-instance
# encounters in on top of whatever the aggregate already lists.
VIRTUAL_INSTANCES: dict[int, list[int]] = {
    -102: [1320, 1317],
    -1:   [1322, 1311, 1041, 1304, 1202, 1030, 1309, 1313],
}

RAID_INSTANCE_ID:    int = -102
DUNGEON_INSTANCE_ID: int = -1

# ---------------------------------------------------------------------------
# Crafted (profession) gear
# ---------------------------------------------------------------------------
#
# Raidbots exposes crafted gear as its own Droptimizer pool, exactly like a raid
# or the M+ chest:
#
#   -88  Epic Profession Items   (professionMidnightEpic)  <- the only one we sim
#   -89  Rare Profession Items
#   -90  PVP Profession Items
#
# Its "encounters" are the eight professions (Alchemy -43, Blacksmithing -33,
# Enchanting -34, Engineering -35, Inscription -36, Jewelcrafting -37,
# Leatherworking -38, Tailoring -39), and encounter-items.json already carries
# every craftable item with a {"instanceId": -88, "encounterId": <profession>}
# source, so no separate item catalogue is needed.
#
# Where a raid item takes an upgrade-track bonus ID, a crafted item takes:
#   * the base-level bonus of the reagent that sets its item level
#     (Spark of Tides 13751 -> 292, Hero Mistcrest 13835 -> 305,
#      Myth Mistcrest 13836 -> 318), and
#   * the crafting-quality bonus, which adds a fixed offset on top
#     (R1 9623 +0, R2 9624 +3, R3 9625 +6, R4 9626 +9, R5 9627 +13).
#
# Re-derive after a patch from the same static data as everything else:
#   /static/data/<hash>/crafting.json            reagent slots -> reagent ids
#   /static/data/<hash>/bonus-id-base-levels.json  bonus id -> baseLevel
# For every reagent slot, baseLevel + quality offset is the resulting item
# level; the frontend's own difficulty list is the cross-check (it names
# professionMidnightEpic-305/-318/-331 for Season 2).

CRAFTED_INSTANCE_ID: int = -88

# Crafting quality we sim.  R5 is the max rank and what anyone ordering a craft
# ends up with, so — like raid tracks at 6/6 — nothing below it is interesting.
CRAFTED_QUALITY: int = 5

# Crafting-quality bonus IDs (all ranks), kept so a previously stamped rank can
# be stripped off an item before the one we want is applied.
CRAFTED_QUALITY_BONUS_IDS: dict[int, int] = {
    1: 9623, 2: 9624, 3: 9625, 4: 9626, 5: 9627,
}

# Difficulty key -> crafted pool configuration.  The key is Raidbots' own
# difficulty ID, exactly as the raid/dungeon keys are.
CRAFTED_DIFFICULTY_MAP: dict[str, dict[str, Any]] = {
    "professionMidnightEpic-331": {
        "name":            "Myth Mistcrest",
        "itemLevel":       331,
        "craftingQuality": CRAFTED_QUALITY,
        # reagent base level (13836 -> 318) + R5 quality offset (9627 -> +13)
        "bonusIds":        [13836, 13751, 9627],
        "source":          "Crafted",
        "instance_id":     CRAFTED_INSTANCE_ID,
        "fight_style":     "Patchwerk",
        "quality":         4,
    },
}

# The default crafted difficulty, used when a caller asks for "the" crafted run.
CRAFTED_DIFFICULTY: str = "professionMidnightEpic-331"

# A crafted item ships with the base-level bonus of its lowest craftable rank
# (Season 2 epics carry 12214 = ilvl 246).  That has to come off before the
# track's own base-level bonus goes on, or Raidbots resolves two item levels for
# one item.  Used only when StaticData carries no bonus_base_levels table.
CRAFTED_FALLBACK_BASE_LEVEL_BONUS_IDS: frozenset[int] = frozenset({12214, 12249})

# Stat IDs Blizzard uses as crafted-stat placeholders (STAT_CRAFT_MOD_1/2).  An
# item with none of these has fixed secondaries, so craftedStats does nothing.
CRAFTED_STAT_PLACEHOLDER_IDS: frozenset[int] = frozenset({24, 25})

# The secondary stats a crafted item's stat slots can be filled with, in the
# order Raidbots lists them.  Every combination is simmed, so the report says
# which pairing is actually best rather than assuming the one on the character.
CRAFTED_SECONDARY_STATS: tuple[tuple[int, str], ...] = (
    (32, "crit"),
    (36, "haste"),
    (49, "mastery"),
    (40, "vers"),
)

# Class ID -> the armour subclass that class wears (1 cloth, 2 leather,
# 3 mail, 4 plate).  Only crafted gear needs this; drop loot carries
# allowableClasses instead.
CLASS_ARMOR_SUBCLASS: dict[int, int] = {
    1:  4,   # Warrior
    2:  4,   # Paladin
    3:  3,   # Hunter
    4:  2,   # Rogue
    5:  1,   # Priest
    6:  4,   # Death Knight
    7:  3,   # Shaman
    8:  1,   # Mage
    9:  1,   # Warlock
    10: 2,   # Monk
    11: 2,   # Druid
    12: 2,   # Demon Hunter
    13: 3,   # Evoker
}

# Base item level used when an item in encounter-items.json has none of its own.
FALLBACK_ITEM_LEVEL: int = UPGRADE_TRACKS["Hero"]["itemLevel"]


def _difficulty(track: str, source: str, instance_id: int) -> dict[str, Any]:
    """Build one DIFFICULTY_MAP entry from an upgrade track name."""
    spec = UPGRADE_TRACKS[track]
    return {
        "upgradeLevel":          spec["bonusId"],
        "levelSelectorSequence": spec["group"],
        "itemLevel":             track,
        "season":                SEASON_SHORT_NAME,
        "source":                source,
        "instance_id":           instance_id,
        "fight_style":           "Patchwerk",
    }


# Difficulty string → Raidbots bonus ID / upgrade track metadata.
#   Normal raid  = Champion track (6/6, ilvl 308)
#   Heroic raid  = Hero track     (6/6, ilvl 321)
#   Mythic raid  = Myth track     (6/6, ilvl 334)
#   M+10 / vault = Myth track, against the dungeon pool
DIFFICULTY_MAP: dict[str, dict[str, Any]] = {
    "raid-normal":              _difficulty("Champion", "Normal",     RAID_INSTANCE_ID),
    "raid-heroic":              _difficulty("Hero",     "Heroic",     RAID_INSTANCE_ID),
    "raid-mythic":              _difficulty("Myth",     "Mythic",     RAID_INSTANCE_ID),
    "dungeon-mythic10":         _difficulty("Myth",     "M+10",       DUNGEON_INSTANCE_ID),
    "dungeon-mythic-weekly10":  _difficulty("Myth",     "M+10 Vault", DUNGEON_INSTANCE_ID),
}


def get_difficulty(difficulty: str) -> dict[str, Any]:
    """Return the config for *difficulty*, drop or crafted, falling back to Heroic.

    Callers that only need the instance/fight style (worker.py) should use this
    rather than indexing DIFFICULTY_MAP, which knows nothing about the crafted
    pool and would silently hand back the raid config for a crafted key.
    """
    if difficulty in CRAFTED_DIFFICULTY_MAP:
        return CRAFTED_DIFFICULTY_MAP[difficulty]
    return DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["raid-heroic"])


def is_crafted(difficulty: str) -> bool:
    """Return ``True`` if *difficulty* targets the crafted (profession) pool."""
    return difficulty in CRAFTED_DIFFICULTY_MAP


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CharacterIdentity:
    """Who is being simulated and which spec string Raidbots expects."""
    name:        str
    realm:       str
    region:      str
    spec_label:  str   # e.g. "Fire" — used in reportName and payload["spec"]
    simc_string: str   # full SimC APL text


@dataclass(frozen=True)
class SimTarget:
    """What simulation to run."""
    difficulty:    str         # "raid-heroic" | "raid-mythic" | crafted key
    instance_id:   int = RAID_INSTANCE_ID   # -102 = Season 2 raid pool
    spec_id:       int = 63
    loot_spec_id:  int = 63
    fight_style:   str = "Patchwerk"
    iterations:    str = "smart"
    crafted_stats: str = "36/49"


@dataclass(frozen=True)
class StaticData:
    """Pre-fetched Raidbots static data needed by build_payload."""
    encounter_items:   list
    instances:         list
    frontend_version:  str
    game_data_version: str = ""
    # bonus id (as a string key) -> {"baseLevel": int, ...}, from
    # /static/data/<hash>/bonus-id-base-levels.json.  Only the crafted pool
    # needs it — see _build_crafted_items — so it stays optional and callers
    # that do not fetch it fall back to CRAFTED_FALLBACK_BASE_LEVEL_BONUS_IDS.
    bonus_base_levels: dict = field(default_factory=dict)
    # [{itemClass, itemSubClass, specsCanDrop, specsCanUse}], from
    # /static/data/<hash>/weapon-specs.json.  Crafted gear carries no
    # allowableClasses, so this is what keeps a mage from simming warglaives.
    weapon_specs: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Internal helpers (previously in droptimizer.py)
# ---------------------------------------------------------------------------

def get_slot_name(inventory_type: int) -> str | None:
    """Map WoW inventoryType integer to a Raidbots slot name string.

    Mirrors Raidbots' own table, except that finger/trinket keep the ``1``
    suffix the payload has always used.  Three entries used to be wrong and
    mattered as soon as crafted weapons were simmed: 13 (INVTYPE_WEAPON — every
    one-handed weapon) was mapped to a trinket, 14 (INVTYPE_SHIELD) to the back
    slot, and 28 to a "ranged" slot Raidbots does not have.
    """
    return {
        1: "head",      2: "neck",      3: "shoulder",  4: "shirt",
        5: "chest",     6: "waist",     7: "legs",      8: "feet",
        9: "wrist",     10: "hands",    11: "finger1",  12: "trinket1",
        13: "main_hand", 14: "off_hand", 15: "main_hand", 16: "back",
        17: "main_hand", 19: "tabard",  20: "chest",    21: "main_hand",
        22: "off_hand", 23: "off_hand", 26: "main_hand", 28: "off_hand",
    }.get(inventory_type)


# Raidbots' profile.equipped uses camelCase for the weapon slots while the rest
# of the payload (and equippedItems) uses snake_case.
_PROFILE_SLOT_ALIASES = {"mainHand": "main_hand", "offHand": "off_hand"}


def merge_equipped(character: dict) -> dict:
    """Flatten a /api/character/load response into slot -> item dict.

    The response splits what the old /wowapi/character endpoint returned as one
    ``items`` map: ``equippedItems`` carries the rich item data (inventoryType,
    itemLevel, stats) while ``profile.equipped`` carries what the character has
    actually done to each piece (enchant_id, gem_id, bonusLists).  We need both
    on one object, so overlay the latter onto the former.
    """
    profile   = character.get("profile") or {}
    rich      = character.get("equippedItems") or {}
    overlay   = profile.get("equipped") or {}

    merged: dict[str, dict] = {}
    for slot, item in rich.items():
        if isinstance(item, dict):
            merged[_PROFILE_SLOT_ALIASES.get(slot, slot)] = dict(item)
    for slot, item in overlay.items():
        if not isinstance(item, dict):
            continue
        key = _PROFILE_SLOT_ALIASES.get(slot, slot)
        merged.setdefault(key, {}).update(item)
    return merged


def _build_droptimizer_items(
    encounter_items: list,
    instance_data:   dict,
    difficulty:      str,
    class_id:        int,
    equipped:        dict,
    upgrade_info:    dict,
    all_instances:   list,
) -> list:
    """Build the droptimizerItems array for a single difficulty/instance."""
    upgrade_bonus_id   = upgrade_info["upgradeLevel"]
    level_selector_seq = upgrade_info["levelSelectorSequence"]
    item_level_name    = upgrade_info["itemLevel"]
    season             = upgrade_info["season"]
    track_spec         = UPGRADE_TRACKS.get(item_level_name, {})
    track_level        = track_spec.get("level", 6)
    track_max          = track_spec.get("max", 6)

    virtual_instance_id = instance_data["id"]
    enc_list = list(instance_data.get("encounters", []))
    # Union Raidbots' own aggregate encounters with the sub-instances we configure.
    # A season's raid aggregate can lag behind a patch raid (this cost us Sporefall
    # in 12.0.7), so we append any configured-instance encounters it is missing
    # rather than only falling back.
    #
    # Two shapes of aggregate exist and must be told apart:
    #   * raid pools (-102) list individual *boss* encounters, so a missing boss
    #     has to be unioned in;
    #   * the M+ pool (-1) lists each *dungeon* as a single encounter whose id is
    #     the dungeon's own instance id.  Unioning that dungeon's bosses on top
    #     would match every item twice — once via its {instanceId: -1} source and
    #     once via its real one — doubling the profilesets Raidbots has to sim.
    # So a sub-instance already named directly by the aggregate is left alone.
    if virtual_instance_id in VIRTUAL_INSTANCES:
        sub_ids = set(VIRTUAL_INSTANCES[virtual_instance_id])
        seen_enc_ids = {e["id"] for e in enc_list if "id" in e}
        enc_list += [
            enc
            for inst in all_instances
            if inst.get("id") in sub_ids and inst.get("id") not in seen_enc_ids
            for enc in inst.get("encounters", [])
            if enc.get("id") not in seen_enc_ids
        ]
    virtual_encounter_ids   = {e["id"] for e in enc_list if "id" in e}
    virtual_encounter_order = {e["id"]: i for i, e in enumerate(enc_list) if "id" in e}

    encounter_to_real_instance: dict[int, int] = {}
    for inst in all_instances:
        inst_id = inst.get("id")
        if inst_id is None or inst_id < 0:
            continue
        for enc in inst.get("encounters", []):
            enc_id = enc.get("id")
            if enc_id is not None and enc_id in virtual_encounter_ids:
                encounter_to_real_instance[enc_id] = inst_id

    log.info(
        "Resolved %d encounters across real instances: %s",
        len(encounter_to_real_instance),
        sorted(set(encounter_to_real_instance.values())),
    )

    result = []

    for item in encounter_items:
        sources   = item.get("sources", [])
        item_class = item.get("itemClass")
        inv_type   = item.get("inventoryType")

        if item_class not in (2, 4):
            continue
        slot = get_slot_name(inv_type)
        if not slot:
            continue

        matching_sources = [
            s for s in sources
            if s.get("encounterId") in virtual_encounter_ids
        ]
        if not matching_sources:
            continue

        allowed_classes = item.get("allowableClasses")
        if allowed_classes and class_id not in allowed_classes:
            continue

        seen = set()
        for src in matching_sources:
            enc_id = src["encounterId"]
            key = (item["id"], enc_id, slot)
            if key in seen:
                continue
            seen.add(key)

            seq_offset   = virtual_encounter_order.get(enc_id, 0)
            real_inst_id = encounter_to_real_instance.get(enc_id, virtual_instance_id)

            bonus_lists = [4799, 4786, upgrade_bonus_id]
            socket_info = item.get("socketInfo", {})
            has_socket = (
                isinstance(socket_info, dict) and
                any(
                    isinstance(v, dict) and v.get("staticSlots", 0) > 0
                    for v in socket_info.values()
                )
            )
            if has_socket:
                bonus_lists = [13668] + bonus_lists

            enchant_id = 0
            for eq_item in equipped.values():
                if not isinstance(eq_item, dict):
                    continue
                if get_slot_name(eq_item.get("inventoryType", 0)) == slot:
                    enchant_id = eq_item.get("enchant_id") or 0
                    break

            real_instance_obj = next(
                (i for i in all_instances if i.get("id") == real_inst_id),
                {"id": real_inst_id},
            )
            encounter_obj = next(
                (
                    e for i in all_instances if i.get("id") == real_inst_id
                    for e in i.get("encounters", []) if e.get("id") == enc_id
                ),
                {"id": enc_id},
            )

            entry = {
                "id": (
                    f"{real_inst_id}/{enc_id}/{difficulty}/{item['id']}/"
                    f"{item.get('itemLevel', FALLBACK_ITEM_LEVEL)}/{enchant_id}/{slot}///"
                ),
                "slot": slot,
                "item": {
                    **{k: v for k, v in item.items() if k != "sources"},
                    "bonusLists":   bonus_lists,
                    "bonus_id":     "/".join(str(b) for b in bonus_lists),
                    "enchant_id":   enchant_id,
                    "gem_id":       "",
                    "instanceId":   real_inst_id,
                    "encounterId":  enc_id,
                    "difficulty":   difficulty,
                    "offSpecItem":  False,
                    "upgrade": {
                        "group":    level_selector_seq,
                        "level":    track_level,
                        "max":      track_max,
                        "name":     item_level_name,
                        "fullName": f"{item_level_name} {track_level}/{track_max}",
                        "bonusId":  upgrade_bonus_id,
                        "itemLevel": item.get("itemLevel", FALLBACK_ITEM_LEVEL),
                        "seasonId": SEASON_ID,
                    },
                    "instance":    real_instance_obj,
                    "encounter":   encounter_obj,
                    "overrides": {
                        "encounterId":                  enc_id,
                        "encounterSequenceOffset":      seq_offset,
                        "instanceId":                   real_inst_id,
                        "difficulty":                   difficulty,
                        "itemLevel":                    item_level_name,
                        "levelSelectorSequence":        level_selector_seq,
                        "season":                       season,
                        "levelSelectorSetUpgradeTrack": True,
                        "seasonId":                     SEASON_ID,
                        "disableWarforgeLevel":         True,
                        "enableSockets":                True,
                        "itemConversion":               dict(ITEM_CONVERSION),
                        "instance":                     real_instance_obj,
                        "encounter":                    encounter_obj,
                        "encounterType":                "boss",
                        "encounterTypePlural":          "bosses",
                        "quality":                      4,
                    },
                    "socketInfo":    item.get("socketInfo", {}),
                    "tooltipParams": {"enchant": enchant_id},
                },
            }
            result.append(entry)

    log.info(
        "Built %d droptimizerItems for instance %s %s",
        len(result), virtual_instance_id, difficulty,
    )
    return result


def _enchant_for_slot(equipped: dict, slot: str) -> int:
    """Return the enchant currently on *slot*, or 0 if there is none."""
    for eq_item in equipped.values():
        if not isinstance(eq_item, dict):
            continue
        if get_slot_name(eq_item.get("inventoryType", 0)) == slot:
            return eq_item.get("enchant_id") or 0
    return 0


def _usable_by(item: dict, class_id: int, spec_id: int, weapon_specs: list) -> bool:
    """Return whether *item* is gear this class/spec could actually wear.

    Raid and dungeon loot carries ``allowableClasses``, so the drop pools filter
    themselves.  Crafted gear does not — every profession item is listed for
    everyone — so armour type and weapon proficiency have to be checked here or
    a mage ends up simming plate and warglaives.
    """
    item_class = item.get("itemClass")
    sub_class  = item.get("itemSubClass")
    inv_type   = item.get("inventoryType")

    # Armour: cloth/leather/mail/plate are decided by class alone.  Subclass 0
    # (cloaks, jewellery, trinkets) is wearable by everyone.
    if item_class == 4 and sub_class in CLASS_ARMOR_SUBCLASS.values():
        return CLASS_ARMOR_SUBCLASS.get(class_id) == sub_class

    # Weapons, shields and off-hand holdables are decided by spec proficiency,
    # which Raidbots publishes as weapon-specs.json.
    is_weapon    = item_class == 2
    is_shield    = item_class == 4 and sub_class == 6
    is_offhand   = item_class == 4 and inv_type == 23
    if is_weapon or is_shield or is_offhand:
        if not weapon_specs or not spec_id:
            return True     # no data to filter with — keep the item
        entry = next(
            (
                w for w in weapon_specs
                if w.get("itemClass") == item_class
                and w.get("itemSubClass") == sub_class
            ),
            None,
        )
        if entry is None:
            return True
        allowed = entry.get("specsCanDrop") or entry.get("specsCanUse") or []
        return spec_id in allowed

    return True


def _crafted_stat_slots(item: dict) -> int:
    """Return how many crafted-stat placeholders (STAT_CRAFT_MOD_1/2) *item* has."""
    return sum(
        1 for stat in item.get("stats") or []
        if isinstance(stat, dict) and stat.get("id") in CRAFTED_STAT_PLACEHOLDER_IDS
    )


def crafted_stat_combos() -> list[dict[str, Any]]:
    """Return every secondary-stat pairing a crafted item can be made with.

    Which stats a crafted item gets is decided at craft time and applies to the
    whole sim, not to one item: Raidbots takes it as ``droptimizer.craftedStats``
    and builds the profilesets itself, ignoring anything per-item we send.  So
    covering every possibility means one sim per pairing — see
    ``worker.run_raidbots_job`` — and this is the list to sweep.

    ``id`` is what the payload field takes (stat IDs, in Raidbots' own order);
    ``label`` is what the result is reported under.
    """
    return [
        {
            "id":     f"{first[0]}/{second[0]}",
            "label":  f"{first[1]}/{second[1]}",
            "stats":  [first[0], second[0]],
        }
        for first, second in combinations(CRAFTED_SECONDARY_STATS, 2)
    ]


def _strip_level_bonuses(bonus_lists: list, bonus_base_levels: dict) -> list:
    """Drop the bonus IDs that set a crafted item's own base item level.

    Every craftable item ships with the base-level bonus of its lowest rank plus,
    once recrafted, a crafting-quality bonus.  Both have to come off before the
    ones for the rank we are simming go on, or Raidbots resolves two item levels
    for the same item.
    """
    quality_ids = set(CRAFTED_QUALITY_BONUS_IDS.values())

    def is_level_bonus(bonus_id: int) -> bool:
        if bonus_id in quality_ids:
            return True
        if bonus_base_levels:
            return str(bonus_id) in bonus_base_levels
        return bonus_id in CRAFTED_FALLBACK_BASE_LEVEL_BONUS_IDS

    return [b for b in bonus_lists if not is_level_bonus(b)]


def _build_crafted_items(
    encounter_items:   list,
    instance_data:     dict,
    difficulty:        str,
    class_id:          int,
    spec_id:           int,
    equipped:          dict,
    crafted_info:      dict,
    crafted_stats:     str,
    bonus_base_levels: dict,
    weapon_specs:      list,
) -> list:
    """Build the droptimizerItems array for the crafted (profession) pool.

    The crafted pool is flat: its "encounters" are the eight professions and an
    item's source names the pool itself, so — unlike the raid pool — there is no
    aggregate to union sub-instances into and no real instance to resolve back
    to.  What differs per item is the bonus list: the track's reagent base-level
    and crafting-quality bonuses replace whatever levelling bonuses the item
    shipped with.
    """
    item_level      = crafted_info["itemLevel"]
    quality         = crafted_info.get("quality", 4)
    crafting_rank   = crafted_info.get("craftingQuality", CRAFTED_QUALITY)
    track_bonus_ids = list(crafted_info["bonusIds"])

    pool_id  = instance_data.get("id", CRAFTED_INSTANCE_ID)
    enc_list = list(instance_data.get("encounters", []))
    enc_by_id = {e["id"]: e for e in enc_list if "id" in e}
    enc_order = {e["id"]: i for i, e in enumerate(enc_list) if "id" in e}

    result = []

    for item in encounter_items:
        if item.get("itemClass") not in (2, 4):
            continue
        slot = get_slot_name(item.get("inventoryType"))
        if not slot:
            continue

        sources = [
            s for s in item.get("sources", [])
            if s.get("instanceId") == pool_id
        ]
        if not sources:
            continue

        allowed_classes = item.get("allowableClasses")
        if allowed_classes and class_id not in allowed_classes:
            continue
        if not _usable_by(item, class_id, spec_id, weapon_specs):
            continue

        # One entry per item: a crafted item has exactly one profession source,
        # and simming it once per profession would only duplicate profilesets.
        enc_id = sources[0].get("encounterId")

        bonus_lists = _strip_level_bonuses(
            list(item.get("bonusLists") or []), bonus_base_levels,
        ) + track_bonus_ids

        socket_info = item.get("socketInfo", {})
        has_socket = (
            isinstance(socket_info, dict) and
            any(
                isinstance(v, dict) and v.get("staticSlots", 0) > 0
                for v in socket_info.values()
            )
        )
        if has_socket:
            bonus_lists = [13668] + bonus_lists

        enchant_id  = _enchant_for_slot(equipped, slot)
        encounter_obj = enc_by_id.get(enc_id, {"id": enc_id})

        # Items with fixed secondaries have no crafted-stat placeholder, so the
        # run's stat choice would be meaningless on them.
        item_stats = crafted_stats if _crafted_stat_slots(item) else None

        result.append(_crafted_entry(
            item=item, crafted_stats=item_stats, slot=slot, pool_id=pool_id,
            enc_id=enc_id, difficulty=difficulty, item_level=item_level,
            quality=quality, crafting_rank=crafting_rank, bonus_lists=bonus_lists,
            track_bonus_ids=track_bonus_ids, enchant_id=enchant_id,
            socket_info=socket_info, instance_data=instance_data,
            encounter_obj=encounter_obj,
            sequence_offset=enc_order.get(enc_id, 0),
        ))

    log.info(
        "Built %d crafted droptimizerItems for %s at ilvl %s",
        len(result), difficulty, item_level,
    )
    return result


def _crafted_entry(
    *,
    item:            dict,
    crafted_stats:   str | None,
    slot:            str,
    pool_id:         int,
    enc_id:          int,
    difficulty:      str,
    item_level:      int,
    quality:         int,
    crafting_rank:   int,
    bonus_lists:     list,
    track_bonus_ids: list,
    enchant_id:      int,
    socket_info:     dict,
    instance_data:   dict,
    encounter_obj:   dict,
    sequence_offset: int,
) -> dict:
    """Build one droptimizerItems entry for a crafted item.

    ``id`` follows Raidbots' own layout so the profileset names in the report
    stay parseable::

        instance/encounter/difficulty/item/ilvl/enchant/slot/
            bonusVariation/statCombo/variation/redirectedBaseStats
    """
    return {
        "id": (
            f"{pool_id}/{enc_id}/{difficulty}/{item['id']}/"
            f"{item_level}/{enchant_id}/{slot}///"
        ),
        "slot": slot,
        "item": {
            **{k: v for k, v in item.items() if k != "sources"},
            "bonusLists":       bonus_lists,
            "bonus_id":         "/".join(str(b) for b in bonus_lists),
            "enchant_id":       enchant_id,
            "gem_id":           "",
            "itemLevel":        item_level,
            "quality":          quality,
            "crafted_stats":    crafted_stats,
            "crafting_quality": crafting_rank,
            "instanceId":       pool_id,
            "encounterId":      enc_id,
            "difficulty":       difficulty,
            "offSpecItem":      False,
            "instance":         instance_data,
            "encounter":        encounter_obj,
            "overrides": {
                "encounterId":             enc_id,
                "encounterSequenceOffset": sequence_offset,
                "instanceId":              pool_id,
                "difficulty":              difficulty,
                "itemLevelOverride":       item_level,
                "craftingQuality":         crafting_rank,
                "quality":                 quality,
                "season":                  SEASON_SHORT_NAME,
                "seasonId":                SEASON_ID,
                "bonusIds":                track_bonus_ids,
                "enableSockets":           True,
                "instance":                instance_data,
                "encounter":               encounter_obj,
                "encounterType":           "profession",
                "encounterTypePlural":     "professions",
            },
            "socketInfo":    socket_info,
            "tooltipParams": {"enchant": enchant_id},
        },
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_payload(
    identity: CharacterIdentity,
    target:   SimTarget,
    character: dict,
    static:   StaticData,
) -> dict:
    """Build a Raidbots Droptimizer submission payload.

    This is a **pure function** — it performs no I/O and always produces the
    same output for the same inputs.

    Args:
        identity:  Character name/realm/region/spec/simc.
        target:    Simulation parameters (difficulty, spec IDs, etc.).
        character: Raw ``POST /api/character/load`` response from Raidbots.
        static:    Pre-fetched encounter items, instances, frontend version.

    Returns:
        A ``dict`` ready to POST to ``/sim``.
    """
    crafted      = is_crafted(target.difficulty)
    upgrade_info = get_difficulty(target.difficulty)
    instance_data = next(
        (i for i in static.instances if i.get("id") == target.instance_id),
        {"id": target.instance_id},
    )

    # /api/character/load returns {profile, equippedItems, profileCacheId, ...}.
    # The sim payload sends `profile` as its `character` field and passes
    # `profileCacheId` alongside so the backend can reuse the cached profile.
    profile          = character.get("profile") or {}
    profile_cache_id = character.get("profileCacheId")
    char_identity    = profile.get("identity") or {}
    equipped         = merge_equipped(character)

    # Talents now have to be sent explicitly — the backend no longer digs them
    # out of the SimC text and rejects the sim with `no_talents` if they are
    # absent.  Raidbots picks the loadout flagged active and submits its
    # `string` (falling back to `rawString`), so mirror that.
    loadouts = (profile.get("talents") or {}).get("loadouts") or []
    active_loadout_obj = next(
        (l for l in loadouts if isinstance(l, dict) and l.get("active")),
        loadouts[0] if loadouts else None,
    )
    active_loadout = None
    if isinstance(active_loadout_obj, dict):
        active_loadout = (
            active_loadout_obj.get("string") or active_loadout_obj.get("rawString")
        )

    class_id = char_identity.get("classId", 8)
    faction  = "alliance" if char_identity.get("faction", 0) == 0 else "horde"

    if crafted:
        droptimizer_items = _build_crafted_items(
            static.encounter_items, instance_data, target.difficulty,
            class_id, target.loot_spec_id or target.spec_id, equipped,
            upgrade_info, target.crafted_stats,
            static.bonus_base_levels, static.weapon_specs,
        )
        report_name = (
            f"Droptimizer \u2022 {SEASON_LABEL} Crafted \u2022 "
            f"{upgrade_info['name']} \u2022 {upgrade_info['itemLevel']} "
            f"R{upgrade_info.get('craftingQuality', CRAFTED_QUALITY)}"
        )
    else:
        droptimizer_items = _build_droptimizer_items(
            static.encounter_items, instance_data, target.difficulty,
            class_id, equipped, upgrade_info, static.instances,
        )
        source_label = upgrade_info.get("source", "Heroic")
        category     = "Dungeons" if target.difficulty.startswith("dungeon-") else "Raids"
        report_name  = (
            f"Droptimizer \u2022 {SEASON_LABEL} {category} \u2022 "
            f"{source_label} \u2022 {upgrade_info['itemLevel']} 6/6"
        )

    return {
        "type":             "droptimizer",
        "text":             identity.simc_string,
        "baseActorName":    identity.name,
        "spec":             identity.spec_label,
        "armory":           {
            "region": identity.region,
            "realm":  identity.realm,
            "name":   identity.name,
        },
        "character":        profile,
        "talents":          active_loadout,
        "activeLoadout":    active_loadout,
        "profileCacheId":   profile_cache_id,
        "reportName":       report_name,
        "frontendHost":     "www.raidbots.com",
        "frontendVersion":  RAIDBOTS_FRONTEND_VERSION,
        "frontendJsHash":   static.frontend_version,
        "gameDataVersion":  static.game_data_version,
        "iterations":       target.iterations,
        "fightStyle":       target.fight_style,
        "fightLength":      300,
        "enemyCount":       1,
        "enemyType":        "FluffyPillow",
        "bloodlust":        True,
        "arcaneIntellect":  True,
        "fortitude":        True,
        "battleShout":      True,
        "mysticTouch":      True,
        "chaosBrand":       True,
        "markOfTheWild":    True,
        "skyfury":          True,
        "bleeding":         True,
        "reportDetails":    True,
        "ptr":              False,
        "simcVersion":      "weekly",
        # Legacy/optional sim toggles — required by Raidbots backend
        "aberration":                      False,
        "apl":                             "",
        "astralAntennaMissChance":         10,
        "attunedToTheAether":              False,
        "augmentation":                    "",
        "balefireBranchRngType":           "constant",
        "blueSilkenLining":                40,
        "cabalistsHymnalInParty":          0,
        "corruptingRageUptime":            80,
        "covenantChance":                  100,
        "cruciblePredation":               True,
        "crucibleSustenance":              True,
        "crucibleViolence":                True,
        "dawnDuskThreadLining":            100,
        "disableIqdExecute":               False,
        "email":                           "",
        "enableDominationShards":          False,
        "enableRuneWords":                 False,
        "essenceGorgerHighStat":           False,
        "flask":                           "",
        "food":                            "",
        "gearsets":                        [],
        "huntersMark":                     True,
        "iqdStatFailChance":               0,
        "loyalToTheEndAllies":             0,
        "nazjatar":                        False,
        "nyalotha":                        True,
        "ocularGlandUptime":               100,
        "ominousChromaticEssenceAllies":   "",
        "ominousChromaticEssencePersonal": "obsidian",
        "potion":                          "",
        "powerInfusion":                   False,
        "primalRitualShell":               "wind",
        "rubyWhelpShellTraining":          "",
        "sendEmail":                       False,
        "smartAggressive":                 False,
        "smartHighPrecision":              True,
        "soleahStatType":                  "haste",
        "stoneLegionHeraldryInParty":      0,
        "surgingVitality":                 0,
        "symbioticPresence":               22,
        "talentSets":                      [],
        "temporaryEnchant":                "",
        "unboundChangelingStatType":       "",
        "undulatingTides":                 100,
        "voidRitual":                      False,
        "whisperingIncarnateIconRoles":    "dps/heal/tank",
        "worldveinAllies":                 0,
        "droptimizer": {
            "instance":           target.instance_id,
            **( {"encounter": -1} if target.difficulty.startswith("dungeon-") else {} ),
            "difficulty":         target.difficulty,
            "warforgeLevel":      0,
            # Crafted items have no upgrade track — their item level comes from
            # the reagent + crafting quality baked into each item's bonus list.
            "upgradeLevel":       0 if crafted else upgrade_info["upgradeLevel"],
            "upgradeEquipped":    False,
            "gem":                None,
            "classId":            class_id,
            "specId":             target.spec_id,
            "lootSpecId":         target.loot_spec_id,
            "faction":            faction,
            "craftedStats":       target.crafted_stats,
            "craftedGem":         None,
            "offSpecItems":       False,
            # Conversions are the catalyst, which never applies to crafted gear.
            "includeConversions": not crafted,
            "excludedItems":      [],
        },
        "droptimizerItems": droptimizer_items,
        "simOptions": {
            "fightstyle": target.fight_style,
            "iterations": target.iterations,
        },
    }
