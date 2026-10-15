// One list of the difficulties the app can sim, shared by the picker, the
// results view and anything else that labels or orders them.

export const DIFFICULTIES: { key: string; label: string; short: string }[] = [
  { key: 'raid-normal',             label: 'Normal',      short: 'Normal' },
  { key: 'raid-heroic',             label: 'Heroic',      short: 'Heroic' },
  { key: 'raid-mythic',             label: 'Mythic',      short: 'Mythic' },
  { key: 'dungeon-mythic10',        label: 'M+ 10',       short: 'M+10' },
  { key: 'dungeon-mythic-weekly10', label: 'M+ 10 Vault', short: 'M+10 Vault' },
  // Raidbots' own id for the Epic Profession Items pool at Myth Mistcrest (331).
  { key: 'professionMidnightEpic-331', label: 'Crafted',  short: 'Crafted' },
]

export const DIFF_ORDER = DIFFICULTIES.map((d) => d.key)

export const DIFF_LABELS: Record<string, string> = Object.fromEntries(
  DIFFICULTIES.map((d) => [d.key, d.short]),
)

export function diffRank(diff: string): number {
  const i = DIFF_ORDER.indexOf(diff)
  return i === -1 ? 99 : i
}

export function diffLabel(diff: string): string {
  return DIFF_LABELS[diff] ?? diff
}
