import { buildLua } from './lua-export'
import type { TooltipRow } from './db'

const row = (overrides: Partial<TooltipRow> = {}): TooltipRow => ({
  item_id: 12345,
  char_name: 'Xiantus',
  realm: 'illidan',
  spec: 'Fire',
  difficulty: 'raid-heroic',
  dps_gain: 450.2,
  ilvl: 639,
  item_name: 'Sword of Testing',
  sim_date: '2025-01-01',
  source: 'Liberation of Undermine',
  ...overrides,
})

describe('buildLua', () => {
  it('returns a non-empty string containing SimdragosaDB', () => {
    const lua = buildLua([row()])
    expect(typeof lua).toBe('string')
    expect(lua.length).toBeGreaterThan(0)
    expect(lua).toContain('SimdragosaDB')
  })

  it('includes the character name and realm as a Lua table key', () => {
    const lua = buildLua([row()])
    expect(lua).toContain('["Xiantus-illidan"]')
  })

  it('includes the item_id as a Lua integer key', () => {
    const lua = buildLua([row()])
    expect(lua).toContain('[12345]')
  })

  it('maps raid-heroic difficulty to heroic key', () => {
    const lua = buildLua([row({ difficulty: 'raid-heroic' })])
    expect(lua).toContain('heroic=')
  })

  it('maps raid-normal difficulty to champion key', () => {
    const lua = buildLua([row({ difficulty: 'raid-normal', dps_gain: 300 })])
    expect(lua).toContain('champion=')
  })

  it('maps raid-mythic difficulty to mythic key', () => {
    const lua = buildLua([row({ difficulty: 'raid-mythic', dps_gain: 600 })])
    expect(lua).toContain('mythic=')
  })

  it('includes item name', () => {
    const lua = buildLua([row({ item_name: 'Sword of Testing' })])
    expect(lua).toContain('Sword of Testing')
  })

  it('returns valid output for empty rows', () => {
    const lua = buildLua([])
    expect(lua).toContain('SimdragosaDB = {')
    expect(lua).toContain('}')
  })

  it('groups multiple specs for same item', () => {
    const rows = [
      row({ spec: 'Fire', difficulty: 'raid-heroic', dps_gain: 450 }),
      row({ spec: 'Fire', difficulty: 'raid-mythic', dps_gain: 600 }),
      row({ spec: 'Arcane', difficulty: 'raid-heroic', dps_gain: 380 }),
    ]
    const lua = buildLua(rows)
    expect(lua).toContain('spec="Fire"')
    expect(lua).toContain('spec="Arcane"')
  })

  it('emits source and sourceType="raid" for raid difficulty', () => {
    const lua = buildLua([row({ difficulty: 'raid-heroic', source: 'Liberation of Undermine' })])
    expect(lua).toContain('source="Liberation of Undermine"')
    expect(lua).toContain('sourceType="raid"')
  })

  it('emits sourceType="dungeon" for dungeon difficulty', () => {
    const lua = buildLua([row({ difficulty: 'dungeon-mythic10', source: 'Ara-Kara, City of Echoes' })])
    expect(lua).toContain('source="Ara-Kara, City of Echoes"')
    expect(lua).toContain('sourceType="dungeon"')
  })

  it('omits source/sourceType when source is null', () => {
    const lua = buildLua([row({ source: null })])
    expect(lua).not.toContain('source=')
    expect(lua).not.toContain('sourceType=')
  })
})
