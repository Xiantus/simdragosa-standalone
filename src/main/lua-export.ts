// src/main/lua-export.ts
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { TooltipRow } from './db'

const DIFF_LUA_KEY: Record<string, string> = {
  'raid-normal': 'champion',
  'raid-heroic': 'heroic',
  'raid-mythic': 'mythic',
  'dungeon-mythic10': 'mplus',
  'dungeon-mythic-weekly10': 'mplus_vault',
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

  // Group: charName → itemId → { specs: {specName: {diffKey: gain}}, ilvl, name, updated }
  type ItemInfo = {
    specs: Record<string, Record<string, number>>
    ilvl: number | null
    name: string | null
    updated: string
  }
  const byChar: Record<string, Record<number, ItemInfo>> = {}

  for (const row of rows) {
    if (!byChar[row.char_name]) byChar[row.char_name] = {}
    const charItems = byChar[row.char_name]
    if (!charItems[row.item_id]) {
      charItems[row.item_id] = { specs: {}, ilvl: row.ilvl, name: row.item_name ?? null, updated: row.sim_date }
    }
    const item = charItems[row.item_id]
    if (!item.specs[row.spec]) item.specs[row.spec] = {}
    const diffKey = DIFF_LUA_KEY[row.difficulty] ?? row.difficulty
    item.specs[row.spec][diffKey] = row.dps_gain
    // Keep freshest date and highest ilvl
    if (row.sim_date > item.updated) item.updated = row.sim_date
    if (row.ilvl && (!item.ilvl || row.ilvl > item.ilvl)) item.ilvl = row.ilvl
    if (row.item_name) item.name = row.item_name
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
      lines.push(`      updated="${info.updated}",`)
      lines.push(`    },`)
    }
    lines.push(`  },`)
  }
  lines.push('}')
  return lines.join('\n') + '\n'
}

export function writeLuaFile(lua: string, wowPath: string): void {
  try {
    const target = join(wowPath, 'SimdragosaData.lua')
    mkdirSync(wowPath, { recursive: true })
    writeFileSync(target, lua, 'utf-8')
    console.log('[lua] Written to', target)
  } catch (err) {
    console.warn('[lua] Could not write to', wowPath, ':', err)
  }
}
