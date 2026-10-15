const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** Results older than this get dimmed — a week covers one raid reset. */
export const STALE_AFTER_MS = 7 * DAY

/** "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(ms: number | undefined | null, now = Date.now()): string {
  if (!ms) return ''
  const d = Math.max(0, now - ms)
  if (d < MIN) return 'just now'
  if (d < HOUR) return `${Math.floor(d / MIN)}m ago`
  if (d < DAY) return `${Math.floor(d / HOUR)}h ago`
  return `${Math.floor(d / DAY)}d ago`
}

export function isStale(ms: number | undefined | null, now = Date.now()): boolean {
  return !!ms && now - ms > STALE_AFTER_MS
}

/** "4m 05s" style remaining-time label. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}
