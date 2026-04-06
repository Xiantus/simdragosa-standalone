"""db.py — SQLite persistence for users and characters."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "autosim.db"


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

@contextmanager
def _connect():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

def _migrate_characters_remove_user_id(conn) -> None:
    """Migration: drop user_id column from characters table if present."""
    cols = [r[1] for r in conn.execute("PRAGMA table_info(characters)").fetchall()]
    if "user_id" not in cols:
        return
    conn.execute("ALTER TABLE characters RENAME TO characters_old")
    conn.execute("""
        CREATE TABLE characters (
            id                        TEXT    NOT NULL PRIMARY KEY,
            name                      TEXT    NOT NULL,
            spec                      TEXT    NOT NULL,
            spec_id                   INTEGER NOT NULL DEFAULT 63,
            loot_spec_id              INTEGER NOT NULL DEFAULT 63,
            region                    TEXT    NOT NULL DEFAULT 'eu',
            realm                     TEXT    NOT NULL DEFAULT '',
            crafted_stats             TEXT    NOT NULL DEFAULT '36/49',
            simc_string               TEXT    NOT NULL DEFAULT '',
            ilvl                      REAL,
            exclude_from_item_updates INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.execute("""
        INSERT OR IGNORE INTO characters
            (id, name, spec, spec_id, loot_spec_id, region, realm,
             crafted_stats, simc_string, ilvl, exclude_from_item_updates)
        SELECT id, name, spec, spec_id, loot_spec_id, region, realm,
               crafted_stats, simc_string, ilvl, exclude_from_item_updates
        FROM characters_old
    """)
    conn.execute("DROP TABLE characters_old")


def _migrate_tooltip_remove_user_id(conn) -> None:
    """Migration: drop user_id from tooltip_data if present."""
    cols = [r[1] for r in conn.execute("PRAGMA table_info(tooltip_data)").fetchall()]
    if "user_id" not in cols:
        return
    conn.execute("ALTER TABLE tooltip_data RENAME TO tooltip_data_old")
    conn.execute("""
        CREATE TABLE tooltip_data (
            item_id    INTEGER NOT NULL,
            char_name  TEXT    NOT NULL,
            realm      TEXT    NOT NULL,
            spec       TEXT    NOT NULL DEFAULT '',
            difficulty TEXT    NOT NULL,
            dps_gain   REAL    NOT NULL,
            ilvl       INTEGER,
            item_name  TEXT,
            sim_date   TEXT    NOT NULL,
            PRIMARY KEY (item_id, char_name, difficulty, spec)
        )
    """)
    conn.execute("""
        INSERT INTO tooltip_data
            (item_id, char_name, realm, spec, difficulty,
             dps_gain, ilvl, item_name, sim_date)
        SELECT item_id, char_name, realm, COALESCE(spec, ''), difficulty,
               dps_gain, ilvl, item_name, sim_date
        FROM tooltip_data_old
    """)
    conn.execute("DROP TABLE tooltip_data_old")



def init_db(db_path: "Path | None" = None) -> None:
    """Initialise the database. If *db_path* is given it overrides the module-level DB_PATH."""
    global DB_PATH
    if db_path is not None:
        DB_PATH = db_path
    with _connect() as conn:

        conn.execute("""
            CREATE TABLE IF NOT EXISTS config (
                key   TEXT NOT NULL PRIMARY KEY,
                value TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS characters (
                id                        TEXT    NOT NULL PRIMARY KEY,
                name                      TEXT    NOT NULL,
                spec                      TEXT    NOT NULL,
                spec_id                   INTEGER NOT NULL DEFAULT 63,
                loot_spec_id              INTEGER NOT NULL DEFAULT 63,
                region                    TEXT    NOT NULL DEFAULT 'eu',
                realm                     TEXT    NOT NULL DEFAULT '',
                crafted_stats             TEXT    NOT NULL DEFAULT '36/49',
                simc_string               TEXT    NOT NULL DEFAULT '',
                ilvl                      REAL,
                exclude_from_item_updates INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tooltip_data (
                item_id    INTEGER NOT NULL,
                char_name  TEXT    NOT NULL,
                realm      TEXT    NOT NULL,
                spec       TEXT    NOT NULL DEFAULT '',
                difficulty TEXT    NOT NULL,
                dps_gain   REAL    NOT NULL,
                ilvl       INTEGER,
                item_name  TEXT,
                sim_date   TEXT    NOT NULL,
                PRIMARY KEY (item_id, char_name, difficulty, spec)
            )
        """)
        _migrate_characters_remove_user_id(conn)
        _migrate_tooltip_remove_user_id(conn)


# ---------------------------------------------------------------------------
# Config helpers (single-user raidsid stored in config table)
# ---------------------------------------------------------------------------

def get_raidsid(user_id=None) -> str:
    """Return the stored raidsid (user_id ignored, kept for API compat)."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT value FROM config WHERE key = 'raidsid'"
        ).fetchone()
    return (row["value"] if row else None) or ""


def set_raidsid(user_id=None, raidsid=None) -> None:
    """Store the raidsid (user_id ignored, kept for API compat)."""
    if raidsid is None and user_id is not None and not isinstance(user_id, int):
        raidsid = user_id
        user_id = None
    with _connect() as conn:
        if raidsid:
            conn.execute(
                "INSERT INTO config (key, value) VALUES ('raidsid', ?)"
                " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (raidsid,),
            )
        else:
            conn.execute("DELETE FROM config WHERE key = 'raidsid'")


# ---------------------------------------------------------------------------
# Character helpers
# ---------------------------------------------------------------------------

def _row_to_char(row) -> dict:
    d = dict(row)
    d["exclude_from_item_updates"] = bool(d["exclude_from_item_updates"])
    return d


def load_characters(user_id=None) -> list:
    """Load all characters (user_id ignored, kept for API compat)."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM characters ORDER BY name, spec"
        ).fetchall()
    return [_row_to_char(r) for r in rows]


def load_all_characters() -> list:
    """Super-user load — returns every character across all accounts (used by Discord bot)."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM characters ORDER BY name, spec"
        ).fetchall()
    return [_row_to_char(r) for r in rows]


def upsert_character(user_id_or_char, char=None) -> None:
    """Upsert a character. Accepts (char,) or legacy (user_id, char) signature."""
    if char is None:
        char = user_id_or_char
    with _connect() as conn:
        conn.execute("""
            INSERT INTO characters
                (id, name, spec, spec_id, loot_spec_id, region, realm,
                 crafted_stats, simc_string, ilvl, exclude_from_item_updates)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name                      = excluded.name,
                spec                      = excluded.spec,
                spec_id                   = excluded.spec_id,
                loot_spec_id              = excluded.loot_spec_id,
                region                    = excluded.region,
                realm                     = excluded.realm,
                crafted_stats             = excluded.crafted_stats,
                simc_string               = excluded.simc_string,
                ilvl                      = excluded.ilvl,
                exclude_from_item_updates = excluded.exclude_from_item_updates
        """, (
            char["id"],
            char["name"], char["spec"],
            char.get("spec_id", 63), char.get("loot_spec_id", 63),
            char.get("region", "eu"), char.get("realm", ""),
            char.get("crafted_stats", "36/49"),
            char.get("simc_string", ""),
            char.get("ilvl"),
            int(bool(char.get("exclude_from_item_updates", False))),
        ))


def update_character_ilvl(user_id_or_char_id, char_id_or_ilvl=None, ilvl=None) -> None:
    """Update character ilvl. Accepts (char_id, ilvl) or legacy (user_id, char_id, ilvl)."""
    if ilvl is None:
        char_id = user_id_or_char_id
        ilvl = char_id_or_ilvl
    else:
        char_id = char_id_or_ilvl
    with _connect() as conn:
        conn.execute(
            "UPDATE characters SET ilvl = ? WHERE id = ?",
            (ilvl, char_id),
        )


def delete_character(user_id_or_char_id, char_id=None) -> None:
    """Delete a character. Accepts (char_id,) or legacy (user_id, char_id)."""
    if char_id is None:
        char_id = user_id_or_char_id
    with _connect() as conn:
        conn.execute(
            "DELETE FROM characters WHERE id = ?",
            (char_id,),
        )


# ---------------------------------------------------------------------------
# Tooltip data helpers
# ---------------------------------------------------------------------------

def upsert_tooltip_entries(
    user_id_or_char_name,
    char_name_or_realm=None,
    realm_or_spec=None,
    spec_or_difficulty=None,
    difficulty_or_entries=None,
    entries_or_sim_date=None,
    sim_date=None,
) -> None:
    """Bulk-upsert item DPS gains for one character + spec + difficulty.

    New signature:  (char_name, realm, spec, difficulty, entries, sim_date)
    Legacy:         (user_id, char_name, realm, spec, difficulty, entries, sim_date)
    """
    if sim_date is None:
        char_name  = user_id_or_char_name
        realm      = char_name_or_realm
        spec       = realm_or_spec
        difficulty = spec_or_difficulty
        entries    = difficulty_or_entries
        sim_date   = entries_or_sim_date
    else:
        char_name  = char_name_or_realm
        realm      = realm_or_spec
        spec       = spec_or_difficulty
        difficulty = difficulty_or_entries
        entries    = entries_or_sim_date

    with _connect() as conn:
        for e in entries:
            conn.execute("""
                INSERT INTO tooltip_data
                    (item_id, char_name, realm, spec, difficulty,
                     dps_gain, ilvl, item_name, sim_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(item_id, char_name, difficulty, spec) DO UPDATE SET
                    dps_gain  = excluded.dps_gain,
                    ilvl      = excluded.ilvl,
                    item_name = excluded.item_name,
                    sim_date  = excluded.sim_date
            """, (
                e["item_id"], char_name, realm, spec, difficulty,
                e["dps_gain"], e.get("ilvl"), e.get("item_name"), sim_date,
            ))


def load_tooltip_data() -> dict:
    """Return nested dict for Lua export, grouped by char -> item -> spec -> difficulty."""
    with _connect() as conn:
        rows = conn.execute(
            """SELECT char_name, realm, spec, difficulty, item_id,
                      dps_gain, ilvl, item_name, sim_date
               FROM tooltip_data
               ORDER BY char_name, item_id, spec"""
        ).fetchall()

    result: dict = {}
    for r in rows:
        key = f"{r['char_name']}-{r['realm'].replace(' ', '').title()}"
        result.setdefault(key, {})
        item_id = r["item_id"]

        spec_name = r["spec"] or ""
        if not spec_name:
            continue

        if item_id not in result[key]:
            result[key][item_id] = {
                "ilvl":    r["ilvl"],
                "name":    r["item_name"] or "",
                "updated": r["sim_date"],
                "specs":   {},   # {spec_name: {diff_key: dps_gain}}
            }
        elif r["sim_date"] > result[key][item_id]["updated"]:
            result[key][item_id]["updated"] = r["sim_date"]

        # Derive track label from ilvl (ground truth) with difficulty fallback
        ilvl = r["ilvl"]
        if ilvl is not None:
            if   ilvl >= 289: diff_key = "mythic"
            elif ilvl >= 276: diff_key = "heroic"
            else:             diff_key = "champion"
        elif "heroic" in r["difficulty"]:  diff_key = "heroic"
        elif "mythic" in r["difficulty"]:  diff_key = "mythic"
        else:                              diff_key = "champion"
        result[key][item_id]["specs"].setdefault(spec_name, {})
        result[key][item_id]["specs"][spec_name][diff_key] = r["dps_gain"]

    return result


def load_tooltip_data_for_user(user_id=1) -> dict:
    """Alias kept for backward compatibility."""
    return load_tooltip_data()
