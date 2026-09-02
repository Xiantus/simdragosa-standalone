"""Guards on the crafted (Epic Profession Items) sim configuration.

Crafted gear is simmed through the same Droptimizer submission as raid loot,
but nothing about it is shared: the pool is -88, the item level comes from a
reagent bonus plus a crafting-quality bonus instead of an upgrade track, and
the items carry no allowableClasses at all.  Each of those is a place a season
rollover can quietly produce a payload that still submits but sims the wrong
thing, so they are pinned here.
"""

import payload_builder as pb


# ---------------------------------------------------------------------------
# Crafted constants
# ---------------------------------------------------------------------------

def test_only_the_epic_profession_pool_is_simmed():
    assert pb.CRAFTED_INSTANCE_ID == -88
    assert set(pb.CRAFTED_DIFFICULTY_MAP) == {"professionMidnightEpic-331"}
    assert pb.CRAFTED_DIFFICULTY in pb.CRAFTED_DIFFICULTY_MAP


def test_crafted_track_is_max_rank():
    cfg = pb.CRAFTED_DIFFICULTY_MAP[pb.CRAFTED_DIFFICULTY]
    assert cfg["craftingQuality"] == pb.CRAFTED_QUALITY == 5
    # The R5 quality bonus has to be the one in the item's bonus list, or the
    # item level Raidbots resolves is a lower rank than the difficulty claims.
    assert pb.CRAFTED_QUALITY_BONUS_IDS[5] in cfg["bonusIds"]


def test_crafted_difficulty_key_matches_its_item_level():
    """Raidbots names its crafted difficulties '<type>-<item level>'."""
    for key, cfg in pb.CRAFTED_DIFFICULTY_MAP.items():
        assert key.endswith(f"-{cfg['itemLevel']}"), key


def test_crafted_difficulties_are_reachable_through_get_difficulty():
    cfg = pb.get_difficulty(pb.CRAFTED_DIFFICULTY)
    assert cfg["instance_id"] == pb.CRAFTED_INSTANCE_ID
    assert pb.is_crafted(pb.CRAFTED_DIFFICULTY)
    assert not pb.is_crafted("raid-heroic")
    # Unknown keys still fall back to the raid config, as callers expect.
    assert pb.get_difficulty("nonsense") is pb.DIFFICULTY_MAP["raid-heroic"]


def test_crafted_pool_stays_out_of_the_drop_difficulty_map():
    """DIFFICULTY_MAP's entries all describe upgrade tracks; crafted has none."""
    assert not set(pb.DIFFICULTY_MAP) & set(pb.CRAFTED_DIFFICULTY_MAP)


# ---------------------------------------------------------------------------
# Slot mapping
# ---------------------------------------------------------------------------

def test_weapon_slots_map_to_weapon_slots():
    """Regression: 13 (every 1H weapon) used to resolve to a trinket."""
    assert pb.get_slot_name(13) == "main_hand"   # INVTYPE_WEAPON
    assert pb.get_slot_name(21) == "main_hand"   # INVTYPE_WEAPONMAINHAND
    assert pb.get_slot_name(22) == "off_hand"    # INVTYPE_WEAPONOFFHAND
    assert pb.get_slot_name(14) == "off_hand"    # INVTYPE_SHIELD
    assert pb.get_slot_name(16) == "back"        # INVTYPE_CLOAK
    assert pb.get_slot_name(12) == "trinket1"


# ---------------------------------------------------------------------------
# Item eligibility
# ---------------------------------------------------------------------------

_WEAPON_SPECS = [
    # Daggers: fire mage yes, fury warrior no.
    {"itemClass": 2, "itemSubClass": 15, "specsCanDrop": [63], "specsCanUse": [63, 72]},
    # Shields: neither.
    {"itemClass": 4, "itemSubClass": 6,  "specsCanDrop": [66], "specsCanUse": [66]},
]

_CLOTH_CHEST = {"itemClass": 4, "itemSubClass": 1, "inventoryType": 5}
_PLATE_CHEST = {"itemClass": 4, "itemSubClass": 4, "inventoryType": 5}
_RING        = {"itemClass": 4, "itemSubClass": 0, "inventoryType": 11}
_DAGGER      = {"itemClass": 2, "itemSubClass": 15, "inventoryType": 13}
_SHIELD      = {"itemClass": 4, "itemSubClass": 6,  "inventoryType": 14}

MAGE, WARRIOR = 8, 1
FIRE, FURY = 63, 72


def test_armour_type_is_filtered_by_class():
    assert pb._usable_by(_CLOTH_CHEST, MAGE, FIRE, _WEAPON_SPECS)
    assert not pb._usable_by(_PLATE_CHEST, MAGE, FIRE, _WEAPON_SPECS)
    assert pb._usable_by(_PLATE_CHEST, WARRIOR, FURY, _WEAPON_SPECS)


def test_jewellery_is_never_filtered_out():
    assert pb._usable_by(_RING, MAGE, FIRE, _WEAPON_SPECS)
    assert pb._usable_by(_RING, WARRIOR, FURY, _WEAPON_SPECS)


def test_weapons_are_filtered_by_spec_proficiency():
    assert pb._usable_by(_DAGGER, MAGE, FIRE, _WEAPON_SPECS)
    assert not pb._usable_by(_DAGGER, WARRIOR, FURY, _WEAPON_SPECS)
    assert not pb._usable_by(_SHIELD, WARRIOR, FURY, _WEAPON_SPECS)


def test_without_weapon_spec_data_nothing_is_dropped():
    """The static file is optional, so an empty table must not empty the sim."""
    assert pb._usable_by(_DAGGER, WARRIOR, FURY, [])


# ---------------------------------------------------------------------------
# build_payload on a crafted fixture
# ---------------------------------------------------------------------------

def _static():
    instances = [{
        "id": -88, "name": "Epic Profession Items", "type": "professionMidnightEpic",
        "encounters": [
            {"id": -33, "name": "Blacksmithing"},
            {"id": -39, "name": "Tailoring"},
        ],
    }]
    encounter_items = [
        {   # cloth, two crafted-stat slots, ships with a base-level bonus
            "id": 910001, "name": "Spellbreaker's Shelter", "itemClass": 4,
            "itemSubClass": 1, "inventoryType": 5, "itemLevel": 197,
            "bonusLists": [12214],
            "stats": [{"id": 24, "alloc": 3500}, {"id": 25, "alloc": 3500}],
            "sources": [{"instanceId": -88, "encounterId": -39}],
            "profession": {"id": 197},
        },
        {   # plate — wrong armour type for the fixture's mage
            "id": 910002, "name": "Bloomforged Breastplate", "itemClass": 4,
            "itemSubClass": 4, "inventoryType": 5, "itemLevel": 197,
            "bonusLists": [12214],
            "sources": [{"instanceId": -88, "encounterId": -33}],
            "profession": {"id": 164},
        },
        {   # neck, no crafted-stat placeholders
            "id": 910003, "name": "Coiled Choker", "itemClass": 4,
            "itemSubClass": 0, "inventoryType": 2, "itemLevel": 197,
            "bonusLists": [12214],
            "stats": [{"id": 32, "alloc": 3500}],
            "sources": [{"instanceId": -88, "encounterId": -37}],
            "profession": {"id": 202},
        },
    ]
    return pb.StaticData(
        encounter_items=encounter_items,
        instances=instances,
        frontend_version="deadbeef",
        game_data_version="cafe",
        bonus_base_levels={"12214": {"baseLevel": 246}},
        weapon_specs=_WEAPON_SPECS,
    )


def _character():
    return {
        "profile": {
            "identity": {"name": "Xiantus", "classId": 8, "faction": 0, "specId": 63},
            "talents": {"loadouts": [{"active": True, "string": "ACTIVE"}]},
            "equipped": {"chest": {"id": 1, "enchant_id": 4242}},
        },
        "equippedItems": {"chest": {"id": 1, "inventoryType": 5, "itemLevel": 300}},
        "profileCacheId": "cache-abc",
    }


def _build(crafted_stats="36/49"):
    identity = pb.CharacterIdentity(
        name="Xiantus", realm="illidan", region="us",
        spec_label="Fire", simc_string="mage\nspec=fire\n",
    )
    target = pb.SimTarget(
        difficulty=pb.CRAFTED_DIFFICULTY, instance_id=pb.CRAFTED_INSTANCE_ID,
        spec_id=63, loot_spec_id=63, crafted_stats=crafted_stats,
    )
    return pb.build_payload(identity, target, _character(), _static())


def test_payload_targets_the_crafted_pool():
    dropt = _build()["droptimizer"]
    assert dropt["instance"] == pb.CRAFTED_INSTANCE_ID
    assert dropt["difficulty"] == pb.CRAFTED_DIFFICULTY
    # Crafted items have no upgrade track, and the catalyst cannot convert them.
    assert dropt["upgradeLevel"] == 0
    assert dropt["includeConversions"] is False
    assert dropt["craftedStats"] == "36/49"


def test_only_wearable_items_are_simmed():
    names = {e["item"]["name"] for e in _build()["droptimizerItems"]}
    assert names == {"Spellbreaker's Shelter", "Coiled Choker"}


def test_items_are_levelled_by_the_crafted_bonus_ids():
    cfg = pb.CRAFTED_DIFFICULTY_MAP[pb.CRAFTED_DIFFICULTY]
    for entry in _build()["droptimizerItems"]:
        item = entry["item"]
        assert item["itemLevel"] == cfg["itemLevel"]
        assert item["crafting_quality"] == cfg["craftingQuality"]
        # The bonus IDs for the rank we want are on...
        assert item["bonusLists"][-len(cfg["bonusIds"]):] == cfg["bonusIds"]
        # ...and the item's own base-level bonus is gone, so only one item
        # level can be resolved from the list.
        assert 12214 not in item["bonusLists"]


def test_crafted_stats_only_go_on_items_that_have_the_slots():
    by_name = {e["item"]["name"]: e["item"] for e in _build()["droptimizerItems"]}
    assert by_name["Spellbreaker's Shelter"]["crafted_stats"] == "36/49"
    assert by_name["Coiled Choker"]["crafted_stats"] is None


def test_each_item_is_simmed_once():
    items = _build()["droptimizerItems"]
    assert len({e["item"]["id"] for e in items}) == len(items)


def test_item_ids_stay_parseable_by_the_report_reader():
    """worker._parse_tooltip_data splits on '/' and reads item id and ilvl."""
    for entry in _build()["droptimizerItems"]:
        parts = entry["id"].split("/")
        assert int(parts[3]) == entry["item"]["id"]
        assert int(parts[4]) == entry["item"]["itemLevel"]


def test_enchants_carry_over_from_the_equipped_slot():
    by_slot = {e["slot"]: e["item"] for e in _build()["droptimizerItems"]}
    assert by_slot["chest"]["enchant_id"] == 4242


def test_report_name_says_what_was_simmed():
    name = _build()["reportName"]
    assert "Crafted" in name and "331" in name and "R5" in name
