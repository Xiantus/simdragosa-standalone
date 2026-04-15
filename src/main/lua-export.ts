// src/main/lua-export.ts
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { TooltipRow } from './db'

const DIFF_LUA_KEY: Record<string, string> = {
  'raid-normal':            'champion',
  'raid-heroic':            'heroic',
  'raid-mythic':            'mythic',
  'dungeon-mythic10':       'heroic',   // M+10 drops = Heroic track
  'dungeon-mythic-weekly10':'mythic',   // M+10 Vault = Mythic track
}

export function buildLua(rows: TooltipRow[]): string {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  const lines: string[] = [
    `-- SimdragosaData.lua  (place in Interface/AddOns/Simdragosa/data/)`,
    `-- Generated: ${now}`,
    `-- Do not edit manually — regenerated after each sim run.`,
    '',
    'SimdragosaDB = {',
  ]

  // Group: charName → itemId → { specs, ilvl, name, updated, source, sourceType }
  type ItemInfo = {
    specs: Record<string, Record<string, number>>
    ilvl: number | null
    name: string | null
    updated: string
    source: string | null
    sourceType: string | null   // "raid" | "dungeon"
  }
  const byChar: Record<string, Record<number, ItemInfo>> = {}

  for (const row of rows) {
    // Key must match what the addon builds: UnitName("player") .. "-" .. GetRealmName():gsub("%s+","")
    const charKey = `${row.char_name}-${row.realm.replace(/\s+/g, '')}`
    if (!byChar[charKey]) byChar[charKey] = {}
    const charItems = byChar[charKey]
    const sourceType = row.difficulty.startsWith('dungeon-') ? 'dungeon' : 'raid'
    if (!charItems[row.item_id]) {
      charItems[row.item_id] = {
        specs: {}, ilvl: row.ilvl, name: row.item_name ?? null, updated: row.sim_date,
        source: row.source ?? null, sourceType,
      }
    }
    const item = charItems[row.item_id]
    if (!item.specs[row.spec]) item.specs[row.spec] = {}
    const diffKey = DIFF_LUA_KEY[row.difficulty] ?? row.difficulty
    item.specs[row.spec][diffKey] = row.dps_gain
    // Keep freshest date and highest ilvl; fill in source if not yet set
    if (row.sim_date > item.updated) item.updated = row.sim_date
    if (row.ilvl && (!item.ilvl || row.ilvl > item.ilvl)) item.ilvl = row.ilvl
    if (row.item_name) item.name = row.item_name
    if (row.source && !item.source) { item.source = row.source; item.sourceType = sourceType }
  }

  for (const [charName, items] of Object.entries(byChar).sort()) {
    lines.push(`  ["${charName}"] = {`)
    for (const [itemIdStr, info] of Object.entries(items).sort(([a], [b]) => Number(a) - Number(b))) {
      lines.push(`    [${itemIdStr}] = {`)
      lines.push(`      specs = {`)
      for (const [specName, gains] of Object.entries(info.specs).sort()) {
        const parts = [`spec="${specName}"`]
        for (const [diffKey, gain] of Object.entries(gains).sort()) {
          parts.push(`${diffKey}=${gain}`)
        }
        lines.push(`        { ${parts.join(', ')} },`)
      }
      lines.push(`      },`)
      if (info.ilvl) lines.push(`      ilvl=${info.ilvl},`)
      if (info.name) lines.push(`      name="${info.name.replace(/"/g, '\\"')}",`)
      if (info.source) {
        lines.push(`      source="${info.source.replace(/"/g, '\\"')}",`)
        lines.push(`      sourceType="${info.sourceType}",`)
      }
      lines.push(`      updated="${info.updated}",`)
      lines.push(`    },`)
    }
    lines.push(`  },`)
  }
  lines.push('}')
  return lines.join('\n') + '\n'
}

/** Resolves the full path to the addon data file given the WoW retail root.
 *  e.g.  C:\Games\World of Warcraft\_retail_
 *        → C:\Games\World of Warcraft\_retail_\Interface\AddOns\Simdragosa\data\SimdragosaData.lua
 */
export function resolveAddonDataPath(wowRoot: string): string {
  return join(wowRoot, 'Interface', 'AddOns', 'Simdragosa', 'data', 'SimdragosaData.lua')
}

export function writeLuaFile(lua: string, wowRoot: string): void {
  try {
    const target = resolveAddonDataPath(wowRoot)
    mkdirSync(join(wowRoot, 'Interface', 'AddOns', 'Simdragosa', 'data'), { recursive: true })
    writeFileSync(target, lua, 'utf-8')
    console.log('[lua] Written to', target)
  } catch (err) {
    console.warn('[lua] Could not write to', wowRoot, ':', err)
  }
}
