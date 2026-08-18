"""Guards on the generated item -> source-name map.

Only element [0] of each tuple is consumed (worker.py uses it as the upgrade's
source label); the kind is informational. These tests protect the properties
that a regeneration could silently break.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python" / "tools"))

import gen_loot_map as gen
from loot_map import ITEM_SOURCE


def test_every_entry_has_a_human_readable_name():
    for item_id, (name, _kind) in ITEM_SOURCE.items():
        assert name and not name.strip().lstrip("-").isdigit(), item_id


def test_current_season_sources_are_present():
    names = {name for name, _ in ITEM_SOURCE.values()}
    assert "The Venomous Abyss" in names
    assert "The Tidebound Grotto" in names
    assert "Catalyst Season 2" in names


def test_previous_season_sources_are_carried_over():
    """Rotated-out seasons can no longer be regenerated, so they must persist."""
    names = {name for name, _ in ITEM_SOURCE.values()}
    assert "The Voidspire" in names
    assert "Sporefall" in names


# ---------------------------------------------------------------------------
# Generator behaviour
# ---------------------------------------------------------------------------

def _instances():
    return [
        {"id": -102, "name": "Season 2 Raids", "type": "raid",
         "encounters": [{"id": 2871}]},
        {"id": 1320, "name": "The Venomous Abyss", "type": "raid",
         "encounters": [{"id": 2871}]},
        {"id": -1, "name": "Mythic+ Dungeons", "type": "mplus-chest",
         "encounters": [{"id": 1322}]},
        {"id": 1322, "name": "Altar of Fangs", "type": "dungeon",
         "encounters": [{"id": 2801}]},
        {"id": -100, "name": "Catalyst Season 2", "type": "catalyst",
         "encounters": [{"id": -100}]},
    ]


def test_raid_wins_over_catalyst_for_a_shared_item():
    """A raid drop that also has a catalyst entry is labelled with the raid."""
    items = [{
        "id": 1, "itemClass": 4,
        # catalyst source listed first on purpose — order must not decide
        "sources": [{"instanceId": -100}, {"instanceId": 1320}],
    }]
    got = gen.build_map(items, _instances(), [-102, -1, -100])
    assert got[1] == ("The Venomous Abyss", "raid")


def test_catalyst_only_item_still_gets_a_name():
    items = [{"id": 2, "itemClass": 4, "sources": [{"instanceId": -100}]}]
    got = gen.build_map(items, _instances(), [-102, -1, -100])
    assert got[2] == ("Catalyst Season 2", "catalyst")


def test_mplus_dungeon_resolves_to_the_dungeon_not_the_pool():
    items = [{"id": 3, "itemClass": 4,
              "sources": [{"instanceId": 1322}, {"instanceId": -1}]}]
    got = gen.build_map(items, _instances(), [-102, -1, -100])
    assert got[3] == ("Altar of Fangs", "dungeon")


def test_non_gear_items_are_skipped():
    items = [{"id": 4, "itemClass": 0, "sources": [{"instanceId": 1320}]}]
    assert gen.build_map(items, _instances(), [-102]) == {}
