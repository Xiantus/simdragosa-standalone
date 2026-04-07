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
  ...overrides,
})

describe('buildLua', () => {
  it('returns a non-empty string containing SimdragosaDB', () => {
    const lua = buildLua([row()])
    expect(typeof lua).toBe('string')
    expect(lua.length).toBeGreaterThan(0)
    expect(lua).toContain('SimdragosaDB')
  })

  it('includes the character name as a Lua table key', () => {
    const lua = buildLua([row()])
    expect(lua).toContain('["Xiantus"]')
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
})
