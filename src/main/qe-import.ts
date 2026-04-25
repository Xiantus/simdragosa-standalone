// src/main/qe-import.ts
// Fetches a QuestionablyEpic Upgrade Report via their public PHP API
// (no Playwright required — pure HTTP GET + JSON parse).
import { net } from 'electron'

const QE_API = 'https://questionablyepic.com/api/getUpgradeReport.php'

// QE dropDifficulty numeric codes observed from the API:
//   5 = Heroic raid max   (ilvl ~276)
//   6 = Mythic+ dungeon   (ilvl ~266)
//   7 = Mythic raid max   (ilvl ~289)
// Empty string means Crafted / Delves — skip these.
const DIFF_KEY: Record<string, string> = {
  '5_Raid':    'raid-heroic',
  '7_Raid':    'raid-mythic',
  '6_Dungeon': 'dungeon-mythic10',
}

export interface QeGain {
  item_id: number
  dps_gain: number   // rawDiff from QE — HPS gain for healers
  ilvl: number
  item_name: string | null
}

export interface QeImportData {
  char_name: string
  realm: string
  region: string
  spec: string         // slug, e.g. "discipline"
  spec_display: string // e.g. "Discipline Priest"
  report_id: string
  url: string
  by_difficulty: Record<string, QeGain[]>  // keyed by "raid-heroic" etc.
}

export function extractReportId(input: string): string | null {
  const trimmed = input.trim()
  // Full URL: https://questionablyepic.com/live/upgradereport/{id}
  const m = trimmed.match(/upgradereport\/([a-z0-9]+)/i)
  if (m) return m[1]
  // Bare alphanumeric ID
  if (/^[a-z0-9]+$/i.test(trimmed)) return trimmed
  return null
}

export async function fetchQeReport(reportId: string): Promise<QeImportData> {
  const url = `${QE_API}?reportID=${encodeURIComponent(reportId)}`
  const res = await net.fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  })
  if (!res.ok) throw new Error(`QE API returned HTTP ${res.status}`)

  const body = await res.json()
  // API wraps the payload in an extra JSON.stringify — unwrap if needed
  const data: any = typeof body === 'string' ? JSON.parse(body) : body

  const specDisplay: string = data.spec ?? ''
  const specSlug = specDisplay.split(' ')[0].toLowerCase()
  const reportUrl = `https://questionablyepic.com/live/upgradereport/${reportId}`

  const byDiff: Record<string, QeGain[]> = {}
  for (const r of data.results ?? []) {
    const diffKey = r.dropDifficulty != null && r.dropDifficulty !== ''
      ? `${r.dropDifficulty}_${r.dropLoc}`
      : null
    const mapped = diffKey ? DIFF_KEY[diffKey] : null
    if (!mapped) continue   // Crafted, Delves, unknown

    if (!byDiff[mapped]) byDiff[mapped] = []
    byDiff[mapped].push({
      item_id: r.item,
      dps_gain: Math.round(r.rawDiff),
      ilvl: r.level,
      item_name: null,
    })
  }

  return {
    char_name: data.playername ?? 'Unknown',
    realm: data.realm ?? '',
    region: (data.region ?? '').toLowerCase(),
    spec: specSlug,
    spec_display: specDisplay,
    report_id: reportId,
    url: reportUrl,
    by_difficulty: byDiff,
  }
}
