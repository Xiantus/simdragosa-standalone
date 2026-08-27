// src/main/qe-browser.ts
// Drives a hidden Electron BrowserWindow to run QuestionablyEpic Upgrade Finder sims.
// Intercepts the addUpgradeReport.php POST to capture results without Playwright.
import { BrowserWindow, session, app } from 'electron'
import { difficultyKeyForRow, QE_M10_INDEX, QE_RAID_LABELS, QE_RAID_TOGGLE } from './qe-import'
import type { QeImportData, QeGain } from './qe-import'

const QE_UF_URL  = 'https://questionablyepic.com/live/upgradefinder'

// QE runs one raid difficulty per report, so a run covering Normal + Heroic +
// Mythic needs three passes.  Mythic+ is orthogonal — every pass also returns
// the +10 rows — so the dungeon results are taken from the first pass only.
const QE_PASS_TIMEOUT_MS = 180_000

// Maps WoW spec_id → exact name used in QE's MUI Select `data-value` attribute
const SPEC_ID_TO_QE_DROPDOWN: Record<number, string> = {
  256:  'Discipline Priest',
  257:  'Holy Priest',
   65:  'Holy Paladin',
  105:  'Restoration Druid',
  264:  'Restoration Shaman',
  270:  'Mistweaver Monk',
  1468: 'Preservation Evoker',
}

const QE_PARTITION = 'persist:qe-sim'
let qeWindow: BrowserWindow | null = null
let sessionSetup = false

let pendingCapture: ((body: string) => void) | null = null
let pendingCaptureReject: ((err: Error) => void) | null = null


function ensureSessionSetup(): void {
  if (sessionSetup) return
  sessionSetup = true

  const ses = session.fromPartition(QE_PARTITION)

  // Capture addUpgradeReport.php POST body
  ses.webRequest.onBeforeRequest(
    { urls: ['https://questionablyepic.com/api/addUpgradeReport.php'] },
    (details, callback) => {
      callback({})
      if (!pendingCapture) return

      const parts = (details.uploadData ?? []) as Array<{ bytes?: ArrayBuffer }>
      const bufs = parts.filter(p => p.bytes).map(p => Buffer.from(p.bytes!))
      if (bufs.length === 0) return

      try {
        const body = Buffer.concat(bufs).toString('utf-8')
        const resolve = pendingCapture
        pendingCapture = null
        pendingCaptureReject = null
        resolve(body)
      } catch (err) {
        const reject = pendingCaptureReject
        pendingCapture = null
        pendingCaptureReject = null
        reject?.(err instanceof Error ? err : new Error(String(err)))
      }
    }
  )
}

function getOrCreateQeWindow(): BrowserWindow {
  if (qeWindow && !qeWindow.isDestroyed()) return qeWindow

  ensureSessionSetup()

  const devMode = !app.isPackaged
  qeWindow = new BrowserWindow({
    show: devMode,
    width: 1440,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: QE_PARTITION,
    },
  })

  if (devMode) {
    qeWindow.webContents.openDevTools({ mode: 'detach' })
    qeWindow.webContents.on('console-message', (_e, _level, msg) => {
      console.log(`[qe-window] ${msg}`)
    })
  }

  qeWindow.on('closed', () => { qeWindow = null })
  return qeWindow
}

function exec(win: BrowserWindow, script: string): Promise<unknown> {
  return win.webContents.executeJavaScript(script, true)
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function waitForEl(selector: string, maxMs = 10000): string {
  return `new Promise(function(resolve) {
    if (document.querySelector(${JSON.stringify(selector)})) return resolve(true)
    var obs = new MutationObserver(function() {
      if (document.querySelector(${JSON.stringify(selector)})) { obs.disconnect(); resolve(true) }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    setTimeout(function() { obs.disconnect(); resolve(false) }, ${maxMs})
  })`
}

// Dispatch full pointer+mouse event sequence to open MUI Select (mirrors Playwright click)
function muiSelectClick(selector: string): string {
  return `(() => {
    var el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return 'not found'
    var rect = el.getBoundingClientRect()
    var cx = rect.left + rect.width / 2
    var cy = rect.top + rect.height / 2
    var opts = { bubbles: true, cancelable: true, button: 0, clientX: cx, clientY: cy }
    el.dispatchEvent(new PointerEvent('pointerover',  opts))
    el.dispatchEvent(new PointerEvent('pointerenter', Object.assign({}, opts, { bubbles: false })))
    el.dispatchEvent(new MouseEvent('mouseover',  opts))
    el.dispatchEvent(new MouseEvent('mouseenter', Object.assign({}, opts, { bubbles: false })))
    el.dispatchEvent(new PointerEvent('pointermove', opts))
    el.dispatchEvent(new MouseEvent('mousemove',  opts))
    el.dispatchEvent(new PointerEvent('pointerdown', opts))
    el.dispatchEvent(new MouseEvent('mousedown',  opts))
    el.dispatchEvent(new PointerEvent('pointerup',   opts))
    el.dispatchEvent(new MouseEvent('mouseup',    opts))
    el.dispatchEvent(new MouseEvent('click',      opts))
    return 'clicked at ' + Math.round(cx) + ',' + Math.round(cy)
  })()`
}

function parseQeReport(jsonBody: string): QeImportData {
  const report = JSON.parse(jsonBody)
  const byDiff: Record<string, QeGain[]> = {}

  for (const r of report.results ?? []) {
    const mapped = difficultyKeyForRow(r)
    if (!mapped) continue
    if (!byDiff[mapped]) byDiff[mapped] = []
    byDiff[mapped].push({
      item_id: r.item,
      dps_gain: Math.round(r.rawDiff),
      ilvl: r.level,
      item_name: null,
    })
  }

  const specDisplay: string = report.spec ?? ''
  const specSlug = specDisplay.split(' ')[0].toLowerCase()

  return {
    char_name: report.playername ?? 'Unknown',
    realm: report.realm ?? '',
    region: (report.region ?? '').toLowerCase(),
    spec: specSlug,
    spec_display: specDisplay,
    report_id: String(report.id ?? ''),
    url: report.id ? `https://questionablyepic.com/live/upgradereport/${report.id}` : '',
    by_difficulty: byDiff,
  }
}

/**
 * JS that puts QE's content toggles into the state one pass needs.
 *
 * The toggle groups render in a fixed order — 4 raid difficulties, 8 Mythic+
 * key levels, then 3 item types (Drop / Upgraded / Bonus Roll) — so each button
 * is found by label first and by ordinal as a fallback, in case QE is showing a
 * non-English locale.  All three item types stay on: the fully-upgraded and
 * vault rows they produce are the ones we actually read.
 */
function configureTogglesScript(raidLabel: string, raidIndex: number): string {
  return `(() => {
    var btns = Array.from(document.querySelectorAll('button.MuiToggleButton-root'))
    if (btns.length < 15) return 'unexpected toggle count: ' + btns.length
    var raid = btns.slice(0, 4), dungeon = btns.slice(4, 12), types = btns.slice(12, 15)
    function norm(b) { return (b.textContent || '').replace(/\\s+/g, ' ').trim() }
    function pick(list, label, idx) {
      return list.filter(function (b) { return norm(b) === label })[0] || list[idx]
    }
    function press(b) {
      if (!b || b.getAttribute('aria-pressed') === 'true') return null
      b.click()
      return norm(b)
    }
    var changed = []
    var r = press(pick(raid, ${JSON.stringify(raidLabel)}, ${raidIndex}))
    if (r) changed.push('raid=' + r)
    var d = press(pick(dungeon, '+10', ${QE_M10_INDEX}))
    if (d) changed.push('m+=' + d)
    types.forEach(function (t) { var c = press(t); if (c) changed.push('type=' + c) })
    return changed.length ? changed.join(', ') : 'already set'
  })()`
}

/** Run one full Upgrade Finder pass for a single raid difficulty. */
async function runQePass(
  win: BrowserWindow,
  simcString: string,
  specLabel: string,
  raidLabel: string,
  raidIndex: number,
  onProgress: (msg: string) => void,
): Promise<QeImportData> {
  const capturePromise = new Promise<string>((resolve, reject) => {
    pendingCapture = resolve
    pendingCaptureReject = reject
  })
  const guardTimeout = setTimeout(() => {
    pendingCapture = null
    pendingCaptureReject = null
  }, QE_PASS_TIMEOUT_MS)

  try {
    // Always navigate to /live/upgradefinder — skips era selection modal.
    // Every pass reloads: QE routes to the report page once a run finishes, so
    // the finder form is gone by the time the next pass starts.
    onProgress('Loading QuestionablyEpic...')
    await win.loadURL(QE_UF_URL)
    await sleep(3000)

    // ── Step 1: Select correct spec via MUI Select dropdown ──────────────
    onProgress('Selecting spec...')
    const dropperResult = await exec(win, muiSelectClick('.MuiSelect-select[role="button"]'))
    console.log(`[qe-browser] MUI dropdown click: ${dropperResult}`)
    await sleep(600)

    // Wait for listbox, then click option by data-value
    const listboxReady = await exec(win, waitForEl('[role="listbox"]', 5000))
    console.log(`[qe-browser] listbox ready: ${listboxReady}`)

    // Log all available data-value options to help diagnose mismatches
    const availableOpts = await exec(win, `(() => {
      return Array.from(document.querySelectorAll('[data-value]')).map(function(el) {
        return el.getAttribute('data-value')
      })
    })()`)
    console.log(`[qe-browser] available data-value options: ${JSON.stringify(availableOpts)}`)

    const optResult = await exec(win, `(() => {
      var opt = document.querySelector('[data-value=${JSON.stringify(specLabel)}]')
      if (opt) { opt.scrollIntoView(); opt.click(); return 'selected: ' + ${JSON.stringify(specLabel)} }
      return 'option not found: ' + ${JSON.stringify(specLabel)}
    })()`)
    console.log(`[qe-browser] spec option: ${optResult}`)
    await sleep(500)

    // Close dropdown if still open (prevents it blocking IMPORT GEAR)
    await exec(win, `(() => {
      if (document.querySelector('[role="listbox"]')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      }
    })()`)
    await sleep(300)

    // ── Step 2: Open import dialog ───────────────────────────────────────
    onProgress('Opening SimC import dialog...')
    const importResult = await exec(win, `(() => {
      var els = Array.from(document.querySelectorAll('button, a, [role="button"]'))
      function norm(el) { return (el.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase() }
      var btn = els.find(function(b) { return norm(b) === 'import gear' })
      if (btn) { btn.scrollIntoView(); btn.click(); return 'clicked' }
      return 'not found. norms: ' + els.slice(0,20).map(norm).join(' | ')
    })()`)
    console.log(`[qe-browser] IMPORT GEAR: ${importResult}`)

    // Wait for dialog (textarea or role=dialog)
    const dialogReady = await exec(win, `new Promise(function(resolve) {
      function check() { return document.querySelector('textarea') || document.querySelector('[role="dialog"]') }
      if (check()) return resolve(true)
      var obs = new MutationObserver(function() { if (check()) { obs.disconnect(); resolve(true) } })
      obs.observe(document.body, { childList: true, subtree: true })
      setTimeout(function() { obs.disconnect(); resolve(false) }, 10000)
    })`)
    console.log(`[qe-browser] dialog ready: ${dialogReady}`)
    if (!dialogReady) throw new Error('SimC import dialog did not open')

    // ── Step 3: Fill SimC string ─────────────────────────────────────────
    onProgress('Pasting SimC profile...')
    const fillResult = await exec(win, `(() => {
      var ta = document.querySelector('textarea')
      if (!ta) return false
      var setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value')?.set
      setter?.call(ta, ${JSON.stringify(simcString)})
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      ta.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    console.log(`[qe-browser] fill: ${fillResult}`)
    await sleep(300)

    // ── Step 4: Click SUBMIT ─────────────────────────────────────────────
    const submitResult = await exec(win, `(() => {
      var btns = Array.from(document.querySelectorAll('button'))
      var sub = btns.find(function(b) { return /^submit$/i.test((b.textContent || '').trim()) })
      if (sub) { sub.click(); return 'clicked' }
      return 'not found'
    })()`)
    console.log(`[qe-browser] SUBMIT: ${submitResult}`)
    if (submitResult !== 'clicked') throw new Error('SUBMIT button not found')

    // QE auto-closes the dialog after processing — wait for it
    onProgress('Importing character...')
    const dialogGone = await exec(win, `new Promise(function(resolve) {
      if (!document.querySelector('[role="dialog"]')) return resolve(true)
      var obs = new MutationObserver(function() {
        if (!document.querySelector('[role="dialog"]')) { obs.disconnect(); resolve(true) }
      })
      obs.observe(document.body, { childList: true, subtree: true })
      setTimeout(function() { obs.disconnect(); resolve(false) }, 15000)
    })`)
    console.log(`[qe-browser] dialog gone: ${dialogGone}`)
    if (!dialogGone) {
      // Force close with Escape if still open
      await exec(win, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
      await sleep(500)
    }

    // ── Step 5: Pick the difficulty toggles ──────────────────────────────
    // QE defaults to Mythic raid + "+10" and remembers the last pick in
    // sessionStorage, so every pass sets them explicitly.
    onProgress(`Selecting ${raidLabel} + M+10...`)
    const toggleResult = await exec(win, configureTogglesScript(raidLabel, raidIndex))
    console.log(`[qe-browser] toggles: ${toggleResult}`)
    await sleep(300)

    // ── Step 6: Click GO ─────────────────────────────────────────────────
    onProgress(`Running ${raidLabel} simulation...`)
    await sleep(500)
    const goResult = await exec(win, `(() => {
      var btns = Array.from(document.querySelectorAll('button'))
      var go = btns.find(function(b) { return /^go[!.]?$/i.test((b.textContent || '').trim()) })
      if (go && !go.disabled) { go.click(); return 'clicked' }
      return go ? 'disabled' : 'not found'
    })()`)
    console.log(`[qe-browser] GO: ${goResult}`)
    if (goResult !== 'clicked') throw new Error(`GO button ${goResult}`)

    // ── Step 7: Wait for results via network intercept ───────────────────
    onProgress(`Waiting for ${raidLabel} results...`)
    const rawBody = await Promise.race([
      capturePromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`QE ${raidLabel} sim timed out after ${QE_PASS_TIMEOUT_MS / 1000} s`)),
          QE_PASS_TIMEOUT_MS,
        )
      ),
    ])

    clearTimeout(guardTimeout)
    return parseQeReport(rawBody)
  } catch (err) {
    clearTimeout(guardTimeout)
    pendingCapture = null
    pendingCaptureReject = null
    throw err
  }
}

/**
 * Run the QE Upgrade Finder for every requested difficulty.
 *
 * QE sims one raid difficulty per report, so this runs one pass per selected
 * raid difficulty.  Mythic+ rows come back with every pass, so the dungeon
 * results are kept from the first one; if only Mythic+ difficulties were
 * selected, a single Mythic pass runs purely for its dungeon rows.
 */
export async function runQeSim(
  simcString: string,
  specId: number,
  difficulties: string[],
  onProgress: (msg: string) => void,
): Promise<QeImportData> {
  const win = getOrCreateQeWindow()
  const specLabel = SPEC_ID_TO_QE_DROPDOWN[specId] ?? 'Discipline Priest'

  const wanted = new Set(difficulties)
  const raidPasses = Object.keys(QE_RAID_TOGGLE)
    .filter((d) => wanted.has(d))
    .map((d) => ({ difficulty: d, index: QE_RAID_TOGGLE[d] }))
    .sort((a, b) => a.index - b.index)

  // Nothing raid-side selected — still need one pass to get the M+ rows.
  const passes = raidPasses.length > 0
    ? raidPasses
    : [{ difficulty: 'raid-mythic', index: QE_RAID_TOGGLE['raid-mythic'] }]

  console.log(
    `[qe-browser] runQeSim — spec_id=${specId} label="${specLabel}" ` +
    `simc_len=${simcString?.length} passes=${passes.map((p) => p.difficulty).join(',')}`
  )

  let first: QeImportData | null = null
  const byDifficulty: Record<string, QeGain[]> = {}
  const urlByDifficulty: Record<string, string> = {}
  let dungeonTaken = false

  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i]
    const raidLabel = QE_RAID_LABELS[pass.index]
    const step = passes.length > 1 ? ` (${i + 1}/${passes.length})` : ''

    const data = await runQePass(
      win, simcString, specLabel, raidLabel, pass.index,
      (msg) => onProgress(msg + step),
    )
    if (!first) first = data

    for (const [difficulty, gains] of Object.entries(data.by_difficulty)) {
      if (!wanted.has(difficulty)) continue
      // Raid rows: keep only the difficulty this pass was run for.
      // Dungeon rows: identical on every pass, so keep the first pass's.
      if (difficulty.startsWith('dungeon-')) {
        if (dungeonTaken) continue
      } else if (difficulty !== pass.difficulty) {
        continue
      }
      byDifficulty[difficulty] = gains
      urlByDifficulty[difficulty] = data.url
    }
    dungeonTaken = true
  }

  return {
    ...(first as QeImportData),
    by_difficulty: byDifficulty,
    url_by_difficulty: urlByDifficulty,
  }
}

export { SPEC_ID_TO_QE_DROPDOWN }

export function destroyQeWindow(): void {
  qeWindow?.destroy()
  qeWindow = null
}
