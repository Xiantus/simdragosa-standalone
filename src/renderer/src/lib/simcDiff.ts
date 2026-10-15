// Compares the gear in two SimC profiles, so a fresh export can say what
// actually changed before the user decides whether to re-sim.

const GEAR_SLOTS = [
  'head', 'neck', 'shoulder', 'back', 'chest', 'wrist', 'hands', 'waist',
  'legs', 'feet', 'finger1', 'finger2', 'trinket1', 'trinket2', 'main_hand', 'off_hand',
]

/** slot → the item line's value, from the equipped section only. */
export function parseGear(simc: string): Record<string, string> {
  const gear: Record<string, string> = {}
  for (const raw of simc.split(/\r?\n/)) {
    const line = raw.trim()
    // Bag and vault items are commented out ("# head=...") — only equipped counts.
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const slot = line.slice(0, eq)
    if (GEAR_SLOTS.includes(slot)) gear[slot] = normaliseItem(line.slice(eq + 1))
  }
  return gear
}

/**
 * The parts of an item line that matter for a sim: id, bonuses, enchant,
 * gems, crafted stats.  Ordering inside the line is not significant.
 */
function normaliseItem(value: string): string {
  return value
    .split(',')
    .map((p) => p.trim())
    .filter((p) => /^(id|bonus_id|enchant_id|gem_id|crafted_stats|ilevel)=/.test(p))
    .sort()
    .join(',')
}

const SLOT_LABELS: Record<string, string> = {
  main_hand: 'main hand', off_hand: 'off hand',
  finger1: 'ring 1', finger2: 'ring 2', trinket1: 'trinket 1', trinket2: 'trinket 2',
}

/** Human labels of slots whose item differs.  Empty when nothing changed. */
export function changedSlots(before: string, after: string): string[] {
  const a = parseGear(before)
  const b = parseGear(after)
  return GEAR_SLOTS
    .filter((s) => (a[s] ?? '') !== (b[s] ?? ''))
    .map((s) => SLOT_LABELS[s] ?? s)
}
