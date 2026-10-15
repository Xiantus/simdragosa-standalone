// src/main/db.ts
import Database from 'better-sqlite3'
import type { Character } from '../shared/ipc'

export interface TooltipRow {
  item_id: number
  char_name: string
  realm: string
  spec: string
  difficulty: string
  dps_gain: number
  ilvl: number | null
  item_name: string | null
  sim_date: string
  source: string | null   // zone/instance name (e.g. "Liberation of Undermine")
  icon?: string | null    // Wowhead icon name (e.g. "spell_holy_prayerofspirit")
  stats?: string | null   // crafted stat combination that won (e.g. "crit/mastery")
}

export interface JobResultRow {
  key: string
  latest_job: any
  last_success_job: any
}

export function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id                       TEXT PRIMARY KEY,
      name                     TEXT NOT NULL,
      realm                    TEXT NOT NULL,
      region                   TEXT NOT NULL,
      spec                     TEXT NOT NULL,
      spec_id                  INTEGER NOT NULL DEFAULT 63,
      loot_spec_id             INTEGER NOT NULL DEFAULT 63,
      simc_string              TEXT NOT NULL DEFAULT '',
      crafted_stats            TEXT NOT NULL DEFAULT '36/49',
      ilvl                     REAL,
      exclude_from_item_updates INTEGER NOT NULL DEFAULT 0,
      simc_updated_at          INTEGER
    );

    CREATE TABLE IF NOT EXISTS tooltip_data (
      item_id    INTEGER NOT NULL,
      char_name  TEXT NOT NULL,
      realm      TEXT NOT NULL,
      spec       TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      dps_gain   REAL NOT NULL,
      ilvl       INTEGER,
      item_name  TEXT,
      sim_date   TEXT NOT NULL,
      source     TEXT,
      stats      TEXT,
      PRIMARY KEY (item_id, char_name, difficulty, spec)
    );

    CREATE TABLE IF NOT EXISTS job_results (
      key              TEXT PRIMARY KEY,
      latest_job       TEXT NOT NULL,
      last_success_job TEXT
    );

    CREATE TABLE IF NOT EXISTS sim_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      char_id      TEXT NOT NULL,
      char_name    TEXT NOT NULL,
      spec         TEXT NOT NULL DEFAULT '',
      difficulty   TEXT NOT NULL,
      ended_at     INTEGER NOT NULL,
      upgrades     INTEGER NOT NULL,
      top_gain     REAL NOT NULL,
      total_gain   REAL NOT NULL,
      top_item_id  INTEGER,
      url          TEXT
    );
    CREATE INDEX IF NOT EXISTS sim_history_char ON sim_history (char_name, ended_at);
    CREATE TABLE IF NOT EXISTS item_names (
      item_id    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      icon       TEXT,
      source     TEXT,
      fetched_at TEXT NOT NULL
    );
  `)
}

export function getCharacters(db: Database.Database): Character[] {
  const rows = db.prepare('SELECT * FROM characters ORDER BY name, spec').all() as any[]
  return rows.map((row) => ({
    ...row,
    exclude_from_item_updates: Boolean(row.exclude_from_item_updates),
  }))
}

export function upsertCharacter(db: Database.Database, char: Character): void {
  // Stamp the moment the gear profile changes, so results simmed before it
  // can be flagged as out of date.
  const prev = db.prepare('SELECT simc_string, simc_updated_at FROM characters WHERE id = ?')
    .get(char.id) as { simc_string: string; simc_updated_at: number | null } | undefined
  const simcUpdatedAt = !prev
    ? (char.simc_string ? Date.now() : null)
    : prev.simc_string !== char.simc_string ? Date.now() : prev.simc_updated_at
  db.prepare(`
    INSERT INTO characters
      (id, name, realm, region, spec, spec_id, loot_spec_id, simc_string, crafted_stats, ilvl, exclude_from_item_updates, simc_updated_at)
    VALUES
      (@id, @name, @realm, @region, @spec, @spec_id, @loot_spec_id, @simc_string, @crafted_stats, @ilvl, @exclude_from_item_updates, @simc_updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name                     = excluded.name,
      realm                    = excluded.realm,
      region                   = excluded.region,
      spec                     = excluded.spec,
      spec_id                  = excluded.spec_id,
      loot_spec_id             = excluded.loot_spec_id,
      simc_string              = excluded.simc_string,
      crafted_stats            = excluded.crafted_stats,
      ilvl                     = excluded.ilvl,
      exclude_from_item_updates = excluded.exclude_from_item_updates,
      simc_updated_at          = excluded.simc_updated_at
  `).run({
    ...char,
    simc_updated_at: simcUpdatedAt,
    ilvl: char.ilvl ?? null,
    exclude_from_item_updates: char.exclude_from_item_updates ? 1 : 0,
  })
}

export function deleteCharacter(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM characters WHERE id = ?').run(id)
}

export function migrateCharacters(db: Database.Database): void {
  try { db.exec('ALTER TABLE characters ADD COLUMN simc_updated_at INTEGER') } catch (_) {}
}

export interface SimHistoryRow {
  char_id: string
  char_name: string
  spec: string
  difficulty: string
  ended_at: number
  upgrades: number
  top_gain: number
  total_gain: number
  top_item_id: number | null
  url: string | null
}

/** Record one finished sim's headline numbers, for the history trend. */
export function insertSimHistory(
  db: Database.Database,
  job: { char_id: string; char_name: string; spec?: string; difficulty: string; ended_at?: number; url?: string; dps_gains?: { item_id: number; dps_gain: number }[] },
): void {
  const gains = job.dps_gains ?? []
  const top = gains.reduce<{ item_id: number; dps_gain: number } | null>(
    (best, g) => (!best || g.dps_gain > best.dps_gain ? g : best), null)
  db.prepare(`
    INSERT INTO sim_history
      (char_id, char_name, spec, difficulty, ended_at, upgrades, top_gain, total_gain, top_item_id, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.char_id, job.char_name, job.spec ?? '', job.difficulty, job.ended_at ?? Date.now(),
    gains.length, top?.dps_gain ?? 0, gains.reduce((s, g) => s + g.dps_gain, 0),
    top?.item_id ?? null, job.url ?? null,
  )
}

export function getSimHistory(db: Database.Database, charName?: string): SimHistoryRow[] {
  const sql = 'SELECT char_id, char_name, spec, difficulty, ended_at, upgrades, top_gain, total_gain, top_item_id, url FROM sim_history'
  return (charName
    ? db.prepare(`${sql} WHERE char_name = ? ORDER BY ended_at`).all(charName)
    : db.prepare(`${sql} ORDER BY ended_at`).all()) as SimHistoryRow[]
}

export function migrateTooltipData(db: Database.Database): void {
  try { db.exec('ALTER TABLE tooltip_data ADD COLUMN source TEXT') } catch (_) {}
  try { db.exec('ALTER TABLE tooltip_data ADD COLUMN stats TEXT') } catch (_) {}
}

export function upsertTooltipRows(db: Database.Database, rows: TooltipRow[]): void {
  const stmt = db.prepare(`
    INSERT INTO tooltip_data
      (item_id, char_name, realm, spec, difficulty, dps_gain, ilvl, item_name, sim_date, source, stats)
    VALUES
      (@item_id, @char_name, @realm, @spec, @difficulty, @dps_gain, @ilvl, @item_name, @sim_date, @source, @stats)
    ON CONFLICT(item_id, char_name, difficulty, spec) DO UPDATE SET
      realm      = excluded.realm,
      dps_gain   = excluded.dps_gain,
      ilvl       = excluded.ilvl,
      item_name  = excluded.item_name,
      sim_date   = excluded.sim_date,
      source     = excluded.source,
      stats      = excluded.stats
  `)
  const insertMany = db.transaction((rows: TooltipRow[]) => {
    // better-sqlite3 rejects a missing named parameter, and `stats` is only
    // filled in by crafted sims.
    for (const row of rows) stmt.run({ ...row, stats: row.stats ?? null })
  })
  insertMany(rows)
}

export function getAllTooltipData(db: Database.Database): TooltipRow[] {
  return db.prepare(`
    SELECT t.item_id, t.char_name, t.realm, t.spec, t.difficulty,
           t.dps_gain, t.ilvl, COALESCE(t.item_name, n.name) AS item_name, t.sim_date,
           t.source, t.stats, n.icon
    FROM tooltip_data t
    LEFT JOIN item_names n ON t.item_id = n.item_id
  `).all() as TooltipRow[]
}

export function deleteTooltipRowsByCharSpecDiff(
  db: Database.Database,
  charName: string,
  spec: string,
  difficulty: string
): void {
  db.prepare(
    'DELETE FROM tooltip_data WHERE char_name = ? AND spec = ? AND difficulty = ?'
  ).run(charName, spec, difficulty)
}

export function upsertJobResult(
  db: Database.Database,
  key: string,
  latestJob: object,
  lastSuccessJob: object | null
): void {
  db.prepare(`
    INSERT INTO job_results (key, latest_job, last_success_job)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      latest_job       = excluded.latest_job,
      last_success_job = COALESCE(excluded.last_success_job, job_results.last_success_job)
  `).run(key, JSON.stringify(latestJob), lastSuccessJob ? JSON.stringify(lastSuccessJob) : null)
}

export function deleteJobResult(db: Database.Database, key: string): void {
  db.prepare('DELETE FROM job_results WHERE key = ?').run(key)
}

export function getJobResults(db: Database.Database): JobResultRow[] {
  const rows = db.prepare('SELECT * FROM job_results').all() as any[]
  return rows.map((row) => ({
    key: row.key,
    latest_job: JSON.parse(row.latest_job),
    last_success_job: row.last_success_job ? JSON.parse(row.last_success_job) : null,
  }))
}

export interface ItemData {
  name: string
  icon?: string | null
  source?: string | null
}

/** Migrate existing item_names rows — add icon/source columns if not yet present. */
export function migrateItemNames(db: Database.Database): void {
  try { db.exec('ALTER TABLE item_names ADD COLUMN icon TEXT') } catch (_) {}
  try { db.exec('ALTER TABLE item_names ADD COLUMN source TEXT') } catch (_) {}
}

export function getCachedItemNames(db: Database.Database, itemIds: number[]): Record<number, ItemData> {
  if (itemIds.length === 0) return {}
  const placeholders = itemIds.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT item_id, name, icon, source FROM item_names WHERE item_id IN (${placeholders})`
  ).all(...itemIds) as { item_id: number; name: string; icon: string | null; source: string | null }[]
  const result: Record<number, ItemData> = {}
  for (const row of rows) result[row.item_id] = { name: row.name, icon: row.icon, source: row.source }
  return result
}

export function upsertItemNames(db: Database.Database, items: Record<number, ItemData>): void {
  const stmt = db.prepare(`
    INSERT INTO item_names (item_id, name, icon, source, fetched_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      name = excluded.name, icon = excluded.icon,
      source = excluded.source, fetched_at = excluded.fetched_at
  `)
  const today = new Date().toISOString().slice(0, 10)
  const run = db.transaction((entries: [number, ItemData][]) => {
    for (const [id, d] of entries) stmt.run(id, d.name, d.icon ?? null, d.source ?? null, today)
  })
  run(Object.entries(items).map(([id, d]) => [Number(id), d]))
}

export function initDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  applySchema(db)
  return db
}
