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
      exclude_from_item_updates INTEGER NOT NULL DEFAULT 0
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
      PRIMARY KEY (item_id, char_name, difficulty, spec)
    );

    CREATE TABLE IF NOT EXISTS job_results (
      key              TEXT PRIMARY KEY,
      latest_job       TEXT NOT NULL,
      last_success_job TEXT
    );

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
  db.prepare(`
    INSERT INTO characters
      (id, name, realm, region, spec, spec_id, loot_spec_id, simc_string, crafted_stats, ilvl, exclude_from_item_updates)
    VALUES
      (@id, @name, @realm, @region, @spec, @spec_id, @loot_spec_id, @simc_string, @crafted_stats, @ilvl, @exclude_from_item_updates)
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
      exclude_from_item_updates = excluded.exclude_from_item_updates
  `).run({
    ...char,
    ilvl: char.ilvl ?? null,
    exclude_from_item_updates: char.exclude_from_item_updates ? 1 : 0,
  })
}

export function deleteCharacter(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM characters WHERE id = ?').run(id)
}

export function upsertTooltipRows(db: Database.Database, rows: TooltipRow[]): void {
  const stmt = db.prepare(`
    INSERT INTO tooltip_data
      (item_id, char_name, realm, spec, difficulty, dps_gain, ilvl, item_name, sim_date)
    VALUES
      (@item_id, @char_name, @realm, @spec, @difficulty, @dps_gain, @ilvl, @item_name, @sim_date)
    ON CONFLICT(item_id, char_name, difficulty, spec) DO UPDATE SET
      realm      = excluded.realm,
      dps_gain   = excluded.dps_gain,
      ilvl       = excluded.ilvl,
      item_name  = excluded.item_name,
      sim_date   = excluded.sim_date
  `)
  const insertMany = db.transaction((rows: TooltipRow[]) => {
    for (const row of rows) stmt.run(row)
  })
  insertMany(rows)
}

export function getAllTooltipData(db: Database.Database): TooltipRow[] {
  return db.prepare('SELECT * FROM tooltip_data').all() as TooltipRow[]
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
      last_success_job = excluded.last_success_job
  `).run(key, JSON.stringify(latestJob), lastSuccessJob ? JSON.stringify(lastSuccessJob) : null)
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
