// src/main/qe-import.ts
// Fetches a QuestionablyEpic Upgrade Report via their public PHP API
// (no Playwright required — pure HTTP GET + JSON parse).
import { net } from 'electron'

const QE_API = 'https://questionablyepic.com/api/getUpgradeReport.php'

// ---------------------------------------------------------------------------
// QE report row → Simdragosa difficulty key
// ---------------------------------------------------------------------------
// Each row of a QE Upgrade Report carries three fields that together identify
// which piece of content the item drops from:
//
//   dropLoc         "Raid" | "Dungeon" | "Crafted" | "Delves"
//   dropDifficulty  Raid    → raid toggle index (0 LFR, 1 Normal, 2 Heroic, 3 Mythic)
//                   Dungeon → Mythic+ key index (7 = +10, the highest QE offers)
//   dropType        "drop"  end-of-run item level
//                   "max"   that item fully upgraded (6/6)
//                   "bonus" the Great Vault / bonus-roll item level
//
// We keep only the fully-upgraded rows so the item levels line up with the
// Raidbots side, which sims every upgrade track at 6/6 (see DIFFICULTY_MAP in
// python/payload_builder.py).  For M+ that means:
//   dungeon-mythic10        = "max"   → +10 end of run, fully upgraded (Hero 6/6)
//   dungeon-mythic-weekly10 = "bonus" → +10 vault                     (Myth 6/6)

/** Raid toggle index → Simdragosa difficulty key.  LFR (0) is not simmed. */
const RAID_DIFF_KEY: Record<number, string> = {
  1: 'raid-normal',
  2: 'raid-heroic',
  3: 'raid-mythic',
}

/** QE Mythic+ key-level index for "+10" — the only key level we sim. */
export const QE_M10_INDEX = 7

/** Simdragosa raid difficulty → QE raid toggle index / button label. */
export const QE_RAID_TOGGLE: Record<string, number> = {
  'raid-normal': 1,
  'raid-heroic': 2,
  'raid-mythic': 3,
}
export const QE_RAID_LABELS = ['LFR', 'Normal', 'Heroic', 'Mythic']

// Reports produced by QE builds from before the Aug 2026 content-settings
// rewrite have no dropType and encode raid difficulty with the old
// Py.difficulties enum (5 = heroicMax, 7 = mythicMax).  Kept so old report
// links pasted into the import box still resolve.
const LEGACY_DIFF_KEY: Record<string, string> = {
  '5_Raid':    'raid-heroic',
  '7_Raid':    'raid-mythic',
  '6_Dungeon': 'dungeon-mythic10',
}

export interface QeReportRow {
  dropLoc?: string
  dropDifficulty?: number | string
  dropType?: string
}

/** Map one QE report row to a Simdragosa difficulty key, or null to skip it. */
export function difficultyKeyForRow(row: QeReportRow): string | null {
  const diff = row.dropDifficulty
  if (diff == null || diff === '') return null   // Crafted, Delves

  if (row.dropType == null) {
    return LEGACY_DIFF_KEY[`${diff}_${row.dropLoc}`] ?? null
  }

  if (row.dropLoc === 'Raid') {
    return row.dropType === 'max' ? (RAID_DIFF_KEY[Number(diff)] ?? null) : null
  }
  if (row.dropLoc === 'Dungeon') {
    if (Number(diff) !== QE_M10_INDEX) return null
    if (row.dropType === 'max') return 'dungeon-mythic10'
    if (row.dropType === 'bonus') return 'dungeon-mythic-weekly10'
  }
  return null
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
  // QE only sims one raid difficulty per report, so a multi-difficulty run
  // produces several reports.  Maps difficulty key → that difficulty's report.
  url_by_difficulty?: Record<string, string>
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
    const mapped = difficultyKeyForRow(r)
    if (!mapped) continue   // Crafted, Delves, LFR, non-upgraded rows

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
