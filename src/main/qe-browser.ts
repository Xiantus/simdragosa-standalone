// src/main/qe-browser.ts
// Drives a hidden Electron BrowserWindow to run QuestionablyEpic Upgrade Finder sims.
// Intercepts the addUpgradeReport.php POST to capture results without Playwright.
import { BrowserWindow, session } from 'electron'
import type { QeImportData, QeGain } from './qe-import'

const DIFF_KEY: Record<string, string> = {
  '5_Raid':    'raid-heroic',
  '7_Raid':    'raid-mythic',
  '6_Dungeon': 'dungeon-mythic10',
}

const QE_PARTITION = 'persist:qe-sim'
let qeWindow: BrowserWindow | null = null
let sessionSetup = false

// One pending capture at a time — resolved by the network interceptor
let pendingCapture: ((body: string) => void) | null = null
let pendingCaptureReject: ((err: Error) => void) | null = null

function ensureSessionSetup(): void {
  if (sessionSetup) return
  sessionSetup = true

  const ses = session.fromPartition(QE_PARTITION)
  ses.webRequest.onBeforeRequest(
    { urls: ['https://questionablyepic.com/api/addUpgradeReport.php'] },
    (details, callback) => {
      callback({}) // never block the outgoing request

      if (!pendingCapture) return

      const parts = (details.uploadData ?? []) as Array<{
        bytes?: ArrayBuffer
        blobUUID?: string
        file?: string
      }>
      const byteBuffers = parts.filter(p => p.bytes).map(p => Buffer.from(p.bytes!))
      if (byteBuffers.length === 0) return

      try {
        const body = Buffer.concat(byteBuffers).toString('utf-8')
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

  qeWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: QE_PARTITION,
    },
  })

  qeWindow.on('closed', () => { qeWindow = null })
  return qeWindow
}

function exec(win: BrowserWindow, script: string): Promise<any> {
  return win.webContents.executeJavaScript(script, true)
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// Set value on a React-controlled input/textarea via native setter
function reactFill(selector: string, value: string): string {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set
    setter?.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`
}

// Wait for a selector to appear in DOM (returns true/false)
function waitForEl(selector: string, maxMs = 10000): string {
  return `new Promise(resolve => {
    if (document.querySelector(${JSON.stringify(selector)})) return resolve(true)
    const obs = new MutationObserver(() => {
      if (document.querySelector(${JSON.stringify(selector)})) { obs.disconnect(); resolve(true) }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { obs.disconnect(); resolve(false) }, ${maxMs})
  })`
}

// Click first matching button/link/tab by text (exact or contains)
function clickText(text: string, exact = false): string {
  const needle = JSON.stringify(text.toLowerCase())
  const cmp = exact
    ? `t === ${needle}`
    : `t.includes(${needle})`
  return `(() => {
    const all = Array.from(document.querySelectorAll('button, a, [role="tab"], [role="button"], [role="menuitem"]'))
    const el = all.find(el => {
      const t = (el.textContent ?? '').trim().toLowerCase()
      return ${cmp} && !(el as HTMLButtonElement).disabled
    })
    if (el) { (el as HTMLElement).click(); return (el as HTMLElement).textContent?.trim() ?? true }
    return null
  })()`
}

// Enable a MUI ToggleButton if not already selected
function ensureToggleOn(text: string): string {
  return `(() => {
    const all = Array.from(document.querySelectorAll('button'))
    const btn = all.find(b => (b.textContent ?? '').trim().toLowerCase() === ${JSON.stringify(text.toLowerCase())})
    if (!btn) return 'not found'
    const on = btn.getAttribute('aria-pressed') === 'true' || btn.classList.contains('Mui-selected')
    if (!on) btn.click()
    return on ? 'already on' : 'toggled on'
  })()`
}

function parseQeReport(jsonBody: string): QeImportData {
  const report = JSON.parse(jsonBody)
  const byDiff: Record<string, QeGain[]> = {}

  for (const r of report.results ?? []) {
    const diffKey =
      r.dropDifficulty != null && r.dropDifficulty !== ''
        ? `${r.dropDifficulty}_${r.dropLoc}`
        : null
    const mapped = diffKey ? DIFF_KEY[diffKey] : null
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

export async function runQeSim(
  simcString: string,
  onProgress: (msg: string) => void,
): Promise<QeImportData> {
  const win = getOrCreateQeWindow()

  // Register capture promise before driving the UI
  const capturePromise = new Promise<string>((resolve, reject) => {
    pendingCapture = resolve
    pendingCaptureReject = reject
  })

  const guardTimeout = setTimeout(() => {
    pendingCapture = null
    pendingCaptureReject = null
  }, 180_000)

  try {
    onProgress('Loading QuestionablyEpic...')
    const currentUrl = win.webContents.getURL()
    if (!currentUrl.includes('questionablyepic.com/live')) {
      await win.loadURL('https://questionablyepic.com/live')
      await sleep(3500)
    } else {
      // Already loaded — reset to home route so character state is fresh
      await exec(win, `history.pushState({}, '', '/live')`)
      await exec(win, `window.dispatchEvent(new PopStateEvent('popstate'))`)
      await sleep(1500)
    }

    onProgress('Opening SimC import dialog...')
    // Try "Import" button — fall back to "Character" or "SimC" labels
    let opened = await exec(win, clickText('import'))
    if (!opened) opened = await exec(win, clickText('character'))
    if (!opened) opened = await exec(win, clickText('simc'))
    await sleep(800)

    onProgress('Pasting SimC profile...')
    const appeared = await exec(win, waitForEl('#simcentry', 8000))
    if (!appeared) throw new Error('SimC import dialog did not open — Import button not found or page changed')

    const filled = await exec(win, reactFill('#simcentry', simcString))
    if (!filled) throw new Error('Could not fill #simcentry textarea')
    await sleep(300)

    // Click the positive action button in the dialog
    await exec(win, `(() => {
      const dialog = document.querySelector('[role="dialog"]')
      const root = dialog ?? document.body
      const btns = Array.from(root.querySelectorAll('button'))
      const submit = btns.find(b => /submit|import|load/i.test(b.textContent ?? ''))
        ?? (btns.filter(b => !(b as HTMLButtonElement).disabled).at(-1))
      ;(submit as HTMLElement | undefined)?.click()
    })()`)
    await sleep(2000)

    onProgress('Navigating to Upgrade Finder...')
    let navClicked = await exec(win, clickText('upgrade finder'))
    if (!navClicked) navClicked = await exec(win, clickText('upgrade'))
    await sleep(1500)

    // Ensure Mythic raid difficulty is enabled (Heroic is on by default)
    onProgress('Configuring difficulties...')
    await exec(win, ensureToggleOn('mythic'))
    await sleep(400)

    onProgress('Running simulation...')
    const goClicked = await exec(win, `(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const go = btns.find(b => /^go$/i.test((b.textContent ?? '').trim()))
      if (go && !(go as HTMLButtonElement).disabled) { go.click(); return true }
      return false
    })()`)

    if (!goClicked) {
      throw new Error('GO button not found or disabled — SimC may not have parsed correctly')
    }

    onProgress('Waiting for results...')
    const rawBody = await Promise.race([
      capturePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('QE sim timed out after 60 s')), 60_000)
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

export function destroyQeWindow(): void {
  qeWindow?.destroy()
  qeWindow = null
}
