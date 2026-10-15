// Remembers what the user last simmed, and named selections they saved, so
// the routine "sim my usual characters" is one click.  Stored per machine in
// localStorage; every access is guarded because storage can be unavailable.

export interface Selection {
  chars: string[]
  diffs: string[]
}

export interface Preset extends Selection {
  name: string
}

const LS_LAST = 'simdragosa:last-selection'
const LS_PRESETS = 'simdragosa:presets'

export const DEFAULT_DIFFS = ['raid-heroic']

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

export function loadLastSelection(): Selection {
  const v = read<Partial<Selection>>(LS_LAST, {})
  return {
    chars: isStringArray(v.chars) ? v.chars : [],
    diffs: isStringArray(v.diffs) && v.diffs.length > 0 ? v.diffs : DEFAULT_DIFFS,
  }
}

export function saveLastSelection(sel: Selection): void {
  write(LS_LAST, sel)
}

/** Difficulties to use when something starts a sim without asking, e.g. the SimC banner. */
export function lastDifficulties(): string[] {
  return loadLastSelection().diffs
}

export function loadPresets(): Preset[] {
  const v = read<unknown>(LS_PRESETS, [])
  if (!Array.isArray(v)) return []
  return v.filter((p): p is Preset =>
    p && typeof p.name === 'string' && isStringArray(p.chars) && isStringArray(p.diffs))
}

export function savePresets(presets: Preset[]): void {
  write(LS_PRESETS, presets)
}

/** Add or replace (by name, case-insensitive) a preset. */
export function upsertPreset(presets: Preset[], preset: Preset): Preset[] {
  const key = preset.name.trim().toLowerCase()
  return [...presets.filter((p) => p.name.trim().toLowerCase() !== key), { ...preset, name: preset.name.trim() }]
}

/** Drop ids that no longer exist, e.g. after a character was deleted. */
export function pruneSelection(sel: Selection, knownCharIds: string[]): Selection {
  const known = new Set(knownCharIds)
  return { ...sel, chars: sel.chars.filter((id) => known.has(id)) }
}
