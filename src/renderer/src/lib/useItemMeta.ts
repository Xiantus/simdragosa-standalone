import { useEffect, useState } from 'react'

export interface ItemMeta {
  name: string
  icon?: string | null
  source?: string | null
}

// Shared across every results view, so switching tabs or expanding a card
// never refetches an item the app has already looked up.
const cache = new Map<number, ItemMeta>()
const inFlight = new Set<number>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const l of listeners) l()
}

async function load(ids: number[]): Promise<void> {
  const missing = ids.filter((id) => !cache.has(id) && !inFlight.has(id))
  if (missing.length === 0) return
  missing.forEach((id) => inFlight.add(id))
  try {
    const res = await window.api.fetchItemNames(missing)
    for (const [id, meta] of Object.entries(res ?? {})) cache.set(Number(id), meta)
    notify()
  } catch {
    /* names are cosmetic — fall back to "Item #id" */
  } finally {
    missing.forEach((id) => inFlight.delete(id))
  }
}

/** Name / icon / source for each id, filled in as Wowhead lookups land. */
export function useItemMeta(ids: number[]): Record<number, ItemMeta> {
  const [, force] = useState(0)
  const key = [...new Set(ids)].sort((a, b) => a - b).join(',')

  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  useEffect(() => {
    if (key) load(key.split(',').map(Number))
  }, [key])

  const out: Record<number, ItemMeta> = {}
  for (const id of ids) {
    const m = cache.get(id)
    if (m) out[id] = m
  }
  return out
}

export function iconUrl(icon: string | null | undefined): string | null {
  return icon ? `https://wow.zamimg.com/images/wow/icons/small/${icon}.jpg` : null
}

/** Test hook: forget everything cached. */
export function _resetItemMetaCache(): void {
  cache.clear()
  inFlight.clear()
}
