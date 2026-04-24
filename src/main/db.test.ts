/**
 * Tests for src/main/db.ts — better-sqlite3 data layer.
 * Uses TDD: these tests define the contract before implementation.
 */
import Database from 'better-sqlite3'
import {
  applySchema,
  getCharacters,
  upsertCharacter,
  deleteCharacter,
  upsertTooltipRows,
  getAllTooltipData,
  upsertJobResult,
  getJobResults,
} from './db'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  applySchema(db)
})

afterEach(() => {
  db.close()
})

describe('characters', () => {
  test('getCharacters returns empty array on fresh database', () => {
    expect(getCharacters(db)).toEqual([])
  })

  test('upsertCharacter then getCharacters returns the inserted character', () => {
    const char = {
      id: 'xiantus-fire',
      name: 'Xiantus',
      realm: 'illidan',
      region: 'us',
      spec: 'Fire',
      spec_id: 63,
      loot_spec_id: 63,
      simc_string: 'mage="Xiantus"\nspec=fire',
      crafted_stats: '36/49',
      ilvl: 639.5,
      exclude_from_item_updates: false,
    }
    upsertCharacter(db, char)
    const result = getCharacters(db)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('xiantus-fire')
    expect(result[0].name).toBe('Xiantus')
    expect(result[0].spec_id).toBe(63)
    expect(result[0].ilvl).toBeCloseTo(639.5)
  })

  test('upsertCharacter updates existing character', () => {
    const char = {
      id: 'xiantus-fire',
      name: 'Xiantus',
      realm: 'illidan',
      region: 'us',
      spec: 'Fire',
      spec_id: 63,
      loot_spec_id: 63,
      simc_string: 'original',
      crafted_stats: '36/49',
    }
    upsertCharacter(db, char)
    upsertCharacter(db, { ...char, simc_string: 'updated', ilvl: 650 })
    const result = getCharacters(db)
    expect(result).toHaveLength(1)
    expect(result[0].simc_string).toBe('updated')
    expect(result[0].ilvl).toBeCloseTo(650)
  })

  test('deleteCharacter removes the target and does not affect others', () => {
    const a = { id: 'char-a', name: 'Alpha', realm: 'illidan', region: 'us', spec: 'Fire', spec_id: 63, loot_spec_id: 63, simc_string: '', crafted_stats: '' }
    const b = { id: 'char-b', name: 'Beta', realm: 'illidan', region: 'us', spec: 'Frost', spec_id: 64, loot_spec_id: 64, simc_string: '', crafted_stats: '' }
    upsertCharacter(db, a)
    upsertCharacter(db, b)
    deleteCharacter(db, 'char-a')
    const result = getCharacters(db)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('char-b')
  })

  test('deleteCharacter on nonexistent id does not throw', () => {
    expect(() => deleteCharacter(db, 'nonexistent')).not.toThrow()
  })
})

describe('tooltip_data', () => {
  test('getAllTooltipData returns empty array on fresh database', () => {
    expect(getAllTooltipData(db)).toEqual([])
  })

  test('upsertTooltipRows then getAllTooltipData returns rows', () => {
    const rows = [
      {
        item_id: 12345,
        char_name: 'Xiantus',
        realm: 'illidan',
        spec: 'Fire',
        difficulty: 'raid-heroic',
        dps_gain: 450.2,
        ilvl: 639,
        item_name: 'Sword of Testing',
        sim_date: '2025-01-01',
        source: null,
        icon: null,
      },
    ]
    upsertTooltipRows(db, rows)
    const result = getAllTooltipData(db)
    expect(result).toHaveLength(1)
    expect(result[0].item_id).toBe(12345)
    expect(result[0].dps_gain).toBeCloseTo(450.2)
  })

  test('upsertTooltipRows overwrites existing row with same composite key', () => {
    const row = {
      item_id: 100,
      char_name: 'Xiantus',
      realm: 'illidan',
      spec: 'Fire',
      difficulty: 'raid-heroic',
      dps_gain: 100.0,
      ilvl: 630,
      item_name: null,
      sim_date: '2025-01-01',
      source: null,
      icon: null,
    }
    upsertTooltipRows(db, [row])
    upsertTooltipRows(db, [{ ...row, dps_gain: 200.0, sim_date: '2025-02-01' }])
    const result = getAllTooltipData(db)
    expect(result).toHaveLength(1)
    expect(result[0].dps_gain).toBeCloseTo(200.0)
  })
})

describe('job_results', () => {
  test('getJobResults returns empty array on fresh database', () => {
    expect(getJobResults(db)).toEqual([])
  })

  test('upsertJobResult then getJobResults returns stored result', () => {
    const key = 'xiantus-fire|raid-heroic|Raid'
    const job = { job_id: 'abc-123', url: 'https://raidbots.com/abc', status: 'done' }
    upsertJobResult(db, key, job, job)
    const results = getJobResults(db)
    expect(results).toHaveLength(1)
    expect(results[0].key).toBe(key)
    expect(results[0].latest_job.job_id).toBe('abc-123')
    expect(results[0].last_success_job.url).toBe('https://raidbots.com/abc')
  })
})
