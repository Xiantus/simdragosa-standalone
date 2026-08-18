"""Guards on the Midnight Season 2 (patch 12.1) payload configuration.

These pin the values that have to move together whenever a season rotates.  If
a future patch bumps the season without updating all of them, the payload still
builds but Raidbots silently sims the wrong loot pool at the wrong item level —
so the failures need to be loud.
"""

import payload_builder as pb


# ---------------------------------------------------------------------------
# Season constants
# ---------------------------------------------------------------------------

def test_season_is_midnight_season_2():
    assert pb.SEASON_ID == 37
    assert pb.SEASON_SHORT_NAME == "mid2"
    assert pb.ITEM_CONVERSION["id"] == 13


def test_raid_pool_is_the_season_2_aggregate():
    assert pb.RAID_INSTANCE_ID == -102
    # The Venomous Abyss (12.1 raid) and The Tidebound Grotto.
    assert set(pb.VIRTUAL_INSTANCES[-102]) == {1320, 1317}


def test_dungeon_pool_has_the_eight_season_2_dungeons():
    assert len(pb.VIRTUAL_INSTANCES[-1]) == 8
    assert len(set(pb.VIRTUAL_INSTANCES[-1])) == 8


def test_upgrade_tracks_are_monotonic_by_item_level():
    order = ["Adventurer", "Veteran", "Champion", "Hero", "Myth"]
    ilvls = [pb.UPGRADE_TRACKS[t]["itemLevel"] for t in order]
    assert ilvls == sorted(ilvls)
    groups = [pb.UPGRADE_TRACKS[t]["group"] for t in order]
    assert groups == sorted(groups) == [614, 615, 616, 617, 618]


# ---------------------------------------------------------------------------
# DIFFICULTY_MAP wiring
# ---------------------------------------------------------------------------

def test_every_difficulty_uses_a_season_2_bonus_id():
    valid = {t["bonusId"] for t in pb.UPGRADE_TRACKS.values()}
    for name, cfg in pb.DIFFICULTY_MAP.items():
        assert cfg["upgradeLevel"] in valid, name
        assert cfg["season"] == pb.SEASON_SHORT_NAME, name


def test_raid_difficulties_map_to_expected_tracks():
    assert pb.DIFFICULTY_MAP["raid-normal"]["itemLevel"] == "Champion"
    assert pb.DIFFICULTY_MAP["raid-heroic"]["itemLevel"] == "Hero"
    assert pb.DIFFICULTY_MAP["raid-mythic"]["itemLevel"] == "Myth"
    for key in ("raid-normal", "raid-heroic", "raid-mythic"):
        assert pb.DIFFICULTY_MAP[key]["instance_id"] == pb.RAID_INSTANCE_ID


def test_dungeon_difficulties_target_the_dungeon_pool():
    for key in ("dungeon-mythic10", "dungeon-mythic-weekly10"):
        assert pb.DIFFICULTY_MAP[key]["instance_id"] == pb.DUNGEON_INSTANCE_ID


def test_bonus_id_and_group_stay_paired():
    """upgradeLevel must belong to the group named in levelSelectorSequence."""
    by_group = {t["group"]: t["bonusId"] for t in pb.UPGRADE_TRACKS.values()}
    for name, cfg in pb.DIFFICULTY_MAP.items():
        assert by_group[cfg["levelSelectorSequence"]] == cfg["upgradeLevel"], name


# ---------------------------------------------------------------------------
# build_payload end-to-end on a minimal fixture
# ---------------------------------------------------------------------------

def _fixture_static():
    instances = [
        {
            "id": -102, "name": "Season 2 Raids", "type": "raid",
            "encounters": [{"id": 2871, "name": "Sszorak"}],
        },
        {
            "id": 1320, "name": "The Venomous Abyss", "type": "raid",
            "encounters": [
                {"id": 2871, "name": "Sszorak"},
                {"id": 2895, "name": "Ula'tek"},      # missing from the aggregate
            ],
        },
    ]
    encounter_items = [
        {
            "id": 900001, "name": "Fanged Helm", "itemClass": 4,
            "inventoryType": 1, "itemLevel": 321,
            "sources": [{"instanceId": 1320, "encounterId": 2871}],
        },
        {
            "id": 900002, "name": "Coiled Band", "itemClass": 4,
            "inventoryType": 11, "itemLevel": 321,
            "sources": [{"instanceId": 1320, "encounterId": 2895}],
        },
    ]
    return pb.StaticData(
        encounter_items=encounter_items,
        instances=instances,
        frontend_version="deadbeef",
    )


def _fixture_character():
    """Shape of a POST /api/character/load response."""
    return {
        "profile": {
            "schemaVersion": 1,
            "identity": {"name": "Xiantus", "classId": 8, "faction": 0, "specId": 63},
            "talents": {"loadouts": [
                {"index": 1, "name": "Inactive", "active": False,
                 "string": "INACTIVE", "rawString": "INACTIVE-RAW"},
                {"index": 2, "name": "Active", "active": True,
                 "string": "ACTIVE", "rawString": "ACTIVE-RAW"},
            ]},
            "equipped": {"head": {"id": 1, "enchant_id": 7777},
                         "mainHand": {"id": 2, "enchant_id": 8888}},
        },
        "equippedItems": {"head": {"id": 1, "inventoryType": 1, "itemLevel": 300},
                          "main_hand": {"id": 2, "inventoryType": 17, "itemLevel": 300}},
        "profileCacheId": "cache-abc",
        "warnings": [],
    }


def _build(difficulty="raid-heroic"):
    identity = pb.CharacterIdentity(
        name="Xiantus", realm="illidan", region="us",
        spec_label="Fire", simc_string="mage\nspec=fire\n",
    )
    cfg = pb.DIFFICULTY_MAP[difficulty]
    target = pb.SimTarget(
        difficulty=difficulty, instance_id=cfg["instance_id"],
        spec_id=63, loot_spec_id=63,
    )
    return pb.build_payload(identity, target, _fixture_character(), _fixture_static())


def test_payload_targets_the_season_2_raid_pool():
    payload = _build()
    assert payload["droptimizer"]["instance"] == -102
    assert payload["droptimizer"]["upgradeLevel"] == pb.UPGRADE_TRACKS["Hero"]["bonusId"]


def test_payload_uses_live_js_hash():
    """Regression: a duplicate dict key used to override this with a stale literal.

    The live hash now goes in frontendJsHash — frontendVersion is a fixed
    literal Raidbots' own frontend sends.
    """
    assert _build()["frontendJsHash"] == "deadbeef"


def test_missing_aggregate_encounters_are_unioned_in():
    """Ula'tek is absent from the -102 encounter list but must still be simmed."""
    items = _build()["droptimizerItems"]
    encounters = {e["item"]["encounterId"] for e in items}
    assert encounters == {2871, 2895}


def test_items_carry_season_2_metadata():
    for entry in _build()["droptimizerItems"]:
        item = entry["item"]
        assert item["upgrade"]["seasonId"] == pb.SEASON_ID
        assert item["upgrade"]["fullName"] == "Hero 6/6"
        assert item["overrides"]["season"] == "mid2"
        assert item["overrides"]["seasonId"] == pb.SEASON_ID
        assert item["overrides"]["itemConversion"]["id"] == 13
        # Items must resolve to the real raid, not the virtual aggregate.
        assert item["instanceId"] == 1320


def test_report_name_reflects_the_active_season():
    assert "Season 2" in _build()["reportName"]


# ---------------------------------------------------------------------------
# M+ pool: the aggregate names dungeons directly, so nothing may be duplicated
# ---------------------------------------------------------------------------

def _mplus_static():
    """Mirrors the real shape: -1 lists each dungeon as one encounter whose id
    is that dungeon's own instance id, while items carry both a virtual source
    ({-1, dungeonId}) and a real one ({dungeonId, bossId})."""
    instances = [
        {
            "id": -1, "name": "Mythic+ Dungeons", "type": "mplus-chest",
            "encounters": [{"id": 1322, "name": "Altar of Fangs"}],
        },
        {
            "id": 1322, "name": "Altar of Fangs", "type": "dungeon",
            "encounters": [{"id": 2801, "name": "First Boss"}],
        },
    ]
    encounter_items = [{
        "id": 900003, "name": "Fanged Cloak", "itemClass": 4,
        "inventoryType": 1, "itemLevel": 334,
        "sources": [
            {"instanceId": 1322, "encounterId": 2801},
            {"instanceId": -1, "encounterId": 1322},
        ],
    }]
    return pb.StaticData(
        encounter_items=encounter_items, instances=instances,
        frontend_version="deadbeef",
    )


def test_mplus_items_are_not_simmed_twice():
    identity = pb.CharacterIdentity(
        name="Xiantus", realm="illidan", region="us",
        spec_label="Fire", simc_string="mage\nspec=fire\n",
    )
    target = pb.SimTarget(
        difficulty="dungeon-mythic10", instance_id=pb.DUNGEON_INSTANCE_ID,
        spec_id=63, loot_spec_id=63,
    )
    items = pb.build_payload(
        identity, target, _fixture_character(), _mplus_static(),
    )["droptimizerItems"]
    assert len(items) == 1


# ---------------------------------------------------------------------------
# /api/character/load response handling
# ---------------------------------------------------------------------------

def test_merge_equipped_overlays_enchants_onto_rich_item_data():
    merged = pb.merge_equipped(_fixture_character())
    # camelCase weapon slots are normalised to the payload's snake_case
    assert set(merged) == {"head", "main_hand"}
    # rich data from equippedItems survives...
    assert merged["head"]["inventoryType"] == 1
    # ...and the enchant from profile.equipped is overlaid on top
    assert merged["head"]["enchant_id"] == 7777
    assert merged["main_hand"]["enchant_id"] == 8888


def test_payload_character_is_the_profile_not_the_envelope():
    payload = _build()
    assert payload["character"] == _fixture_character()["profile"]
    assert payload["profileCacheId"] == "cache-abc"


def test_class_and_faction_come_from_profile_identity():
    payload = _build()
    assert payload["droptimizer"]["classId"] == 8
    assert payload["droptimizer"]["faction"] == "alliance"


def test_active_talent_loadout_is_submitted():
    """Regression: submitting without talents is rejected with `no_talents`."""
    payload = _build()
    assert payload["talents"] == "ACTIVE"
    assert payload["activeLoadout"] == "ACTIVE"


def test_enchants_are_read_from_the_merged_equipment():
    for entry in _build()["droptimizerItems"]:
        if entry["slot"] == "head":
            assert entry["item"]["enchant_id"] == 7777
            break
    else:
        raise AssertionError("no head item in fixture payload")


def test_droptimizer_block_drops_equipped_and_adds_new_fields():
    dropt = _build()["droptimizer"]
    assert "equipped" not in dropt        # moved into `character`
    assert dropt["excludedItems"] == []
    assert "craftedGem" in dropt


def test_version_fields_are_split():
    payload = _build()
    assert payload["frontendVersion"] == pb.RAIDBOTS_FRONTEND_VERSION
    assert payload["frontendJsHash"] == "deadbeef"
