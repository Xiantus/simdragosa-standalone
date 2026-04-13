import { app, BrowserWindow, ipcMain, shell, net } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { initDb, getCharacters, upsertCharacter, deleteCharacter, getAllTooltipData, upsertTooltipRows, getJobResults, deleteJobResult, getCachedItemNames, upsertItemNames, migrateItemNames, type ItemData } from './db'
import { buildLua, writeLuaFile, resolveAddonDataPath } from './lua-export'
import { spawnWorker, cancelAllWorkers, findPython, type JobSpec } from './sim-runner'
import { createTray, destroyTray } from './tray'
import { setupAutoUpdater, checkForUpdatesNow } from './updater'
import { autoUpdater } from 'electron-updater'
import { createTriggerWindow, showTriggerWindow, hideTriggerWindow, destroyTriggerWindow, registerTriggerIpc } from './trigger-window'
import { startWatcher, stopWatcher } from './simc-watcher'
import type { Character, Settings, SimSelection } from '../shared/ipc'

interface StoreSchema {
  raidsid: string
  wow_path: string
  windowBounds: { width: number; height: number; x?: number; y?: number }
  alwaysOnTop: boolean
  overlayMode: boolean
  triggerPosition: { x: number; y: number }
  watchSimcExports: boolean
  simcSeenTimestamps: Record<string, number>
}

const store = new Store<StoreSchema>({
  defaults: {
    raidsid: '',
    wow_path: '',
    windowBounds: { width: 1200, height: 800 },
    alwaysOnTop: false,
    overlayMode: false,
    triggerPosition: { x: 120, y: 120 },
    watchSimcExports: true,
    simcSeenTimestamps: {},
  },
})

const HEALER_SPEC_IDS = new Set([65, 105, 256, 257, 264, 270, 1468])

let mainWindow: BrowserWindow | null = null
let db: ReturnType<typeof initDb>

/** Pull "Dropped by / Drops from / Quest" source text out of Wowhead's tooltip HTML. */
function extractWowheadSource(html: string): string | null {
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const patterns = [
    /Dropped?\s+by:\s*([^.]+?)(?:\s{2,}|Drop|Quest|Sold|$)/i,
    /Drops?\s+from:\s*([^.]+?)(?:\s{2,}|Drop|Quest|Sold|$)/i,
    /Drops?\s+in:\s*([^.]+?)(?:\s{2,}|Drop|Quest|Sold|$)/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) return m[1].trim().replace(/\s+/g, ' ')
  }
  return null
}

function createWindow(): void {
  const bounds = store.get('windowBounds')
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    ...(bounds.x !== undefined ? { x: bounds.x } : {}),
    ...(bounds.y !== undefined ? { y: bounds.y } : {}),
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Save bounds and hide to tray instead of quitting on close
  mainWindow.on('close', (e) => {
    if (mainWindow) store.set('windowBounds', mainWindow.getBounds())
    if (!(app as any)._quitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Prevent any external link from navigating the main window itself
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })

  // Wowhead's tooltip API rejects requests with Origin: null (file:// pages).
  // Spoof the origin so power.js tooltips work in the Electron renderer.
  const wowheadHosts = ['*://nether.wowhead.com/*', '*://wow.zamimg.com/*']
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: wowheadHosts },
    (details, callback) => {
      details.requestHeaders['Origin'] = 'https://www.wowhead.com'
      details.requestHeaders['Referer'] = 'https://www.wowhead.com/'
      callback({ requestHeaders: details.requestHeaders })
    }
  )
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: wowheadHosts },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'access-control-allow-origin': ['*'],
        },
      })
    }
  )

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  ipcMain.on('window:minimize', () => {
    // In overlay mode the window has no taskbar entry, so minimize would make
    // it unreachable and also kill the trigger button. Hide instead so the
    // floating trigger button can still be used to bring it back.
    if (store.get('overlayMode')) mainWindow?.hide()
    else mainWindow?.minimize()
  })
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  // Close button sends window to tray
  ipcMain.on('window:close', () => mainWindow?.hide())
}

function registerIpcHandlers(): void {
  // Characters
  ipcMain.handle('getCharacters', () => getCharacters(db))
  ipcMain.handle('upsertCharacter', (_event, char: Character) => {
    if (!char.id) {
      char.id = `${char.name.toLowerCase()}-${char.spec.toLowerCase()}`
    }
    upsertCharacter(db, char)
  })
  ipcMain.handle('deleteCharacter', (_event, id: string) => deleteCharacter(db, id))

  // Settings
  ipcMain.handle('getSettings', (): Settings => ({
    raidsid: store.get('raidsid'),
    wow_path: store.get('wow_path'),
    is_configured: Boolean(store.get('raidsid')),
    version: app.getVersion(),
  }))
  ipcMain.handle('saveSettings', (_event, partial: Partial<Settings>) => {
    if (partial.raidsid !== undefined) store.set('raidsid', partial.raidsid)
    if (partial.wow_path !== undefined) {
      store.set('wow_path', partial.wow_path)
      // Restart watcher with the new path
      if (store.get('watchSimcExports') && mainWindow) {
        startWatcher(
          partial.wow_path,
          mainWindow,
          () => store.get('simcSeenTimestamps'),
          (ts) => store.set('simcSeenTimestamps', ts),
        )
      }
    }
  })

  // SimC export dismiss — record the timestamp so we don't re-prompt for it
  ipcMain.on('simc:dismiss', (_event, charKey: string, timestamp: number) => {
    const seen = store.get('simcSeenTimestamps')
    store.set('simcSeenTimestamps', { ...seen, [charKey]: timestamp })
  })

  ipcMain.handle('fetchItemNames', async (_event, itemIds: number[]): Promise<Record<number, ItemData>> => {
    if (!itemIds || itemIds.length === 0) return {}

    // Return cached data immediately; only hit Wowhead for unknowns
    const cached = getCachedItemNames(db, itemIds)
    const missing = itemIds.filter((id) => !cached[id])

    if (missing.length > 0) {
      const fetched: Record<number, ItemData> = {}
      for (let i = 0; i < missing.length; i++) {
        const id = missing[i]
        try {
          const res = await net.fetch(`https://nether.wowhead.com/tooltip/item/${id}`)
          if (res.ok) {
            const json = await res.json() as { name?: string; icon?: string; tooltip?: string }
            if (json.name) {
              fetched[id] = {
                name: json.name,
                icon: json.icon ?? null,
                source: json.tooltip ? extractWowheadSource(json.tooltip) : null,
              }
            }
          } else {
            console.warn(`[items] Wowhead returned ${res.status} for item ${id}`)
          }
        } catch (err) {
          console.warn(`[items] Failed to fetch item ${id}:`, err)
        }
        if (i < missing.length - 1) await new Promise((r) => setTimeout(r, 80))
      }
      if (Object.keys(fetched).length > 0) upsertItemNames(db, fetched)
      return { ...cached, ...fetched }
    }

    return cached
  })

  ipcMain.handle('getJobResults', () => {
    const rows = getJobResults(db)
    // Return the latest_job record for each key; fall back to last_success_job
    return rows
      .map((r) => r.latest_job ?? r.last_success_job)
      .filter(Boolean)
  })

  ipcMain.handle('deleteResult', (_event, char_id: string, difficulty: string, build_label: string) => {
    deleteJobResult(db, `${char_id}|${difficulty}|${build_label}`)
  })

  // Sim launch (#21)
  ipcMain.handle('startSim', async (_event, selection: SimSelection) => {
    const raidsid = store.get('raidsid')
    if (!raidsid) throw new Error('No raidsid configured')
    const characters = getCharacters(db)
    const charMap = new Map(characters.map((c) => [c.id, c]))

    const queued: Array<{ job_id: string; char_id: string; char_name: string; spec: string; difficulty: string; build_label: string }> = []

    for (const charId of selection.character_ids) {
      const char = charMap.get(charId)
      if (!char) continue
      for (const difficulty of selection.difficulties) {
        const job_id = `${charId}-${difficulty}-${Date.now()}`
        // Healer sims (QE Live) are temporarily disabled — skip and notify.
        if (HEALER_SPEC_IDS.has(char.spec_id)) {
          mainWindow?.webContents.send('job:error', {
            job_id,
            char_name: char.name,
            message: 'Healer sims are not supported yet in this version.',
          })
          continue
        }

        const spec: JobSpec = {
          type: 'raidbots',
          job_id,
          character: char,
          difficulty,
          build_label: 'Default',
          talent_code: null,
          raidsid,
          raidbots_api_key: null,
          timeout_minutes: 30,
        }
        queued.push({ job_id, char_id: charId, char_name: char.name, spec: char.spec, difficulty, build_label: 'Default' })
        if (mainWindow) spawnWorker(spec, mainWindow, db, (dpsGains, charName, specName, difficulty) => {
          const rows = dpsGains.map((g: any) => ({
            item_id: g.item_id,
            char_name: charName,
            realm: spec.character.realm,
            spec: specName,
            difficulty,
            dps_gain: g.dps_gain,
            ilvl: g.ilvl ?? null,
            item_name: g.item_name ?? null,
            sim_date: new Date().toISOString().slice(0, 10),
          }))
          if (rows.length > 0) {
            upsertTooltipRows(db, rows)
            const wow_path = store.get('wow_path')
            if (wow_path) {
              const allRows = getAllTooltipData(db)
              writeLuaFile(buildLua(allRows), wow_path)
            }
          }
        })
      }
    }

    return queued
  })
  ipcMain.handle('cancelJobs', () => cancelAllWorkers())
  ipcMain.handle('checkForUpdates', () => checkForUpdatesNow())
  ipcMain.on('update:restart', () => { autoUpdater.quitAndInstall() })

  // Overlay mode
  ipcMain.handle('getOverlayMode', () => store.get('overlayMode'))
  ipcMain.handle('setOverlayMode', (_event, enabled: boolean) => {
    store.set('overlayMode', enabled)
    if (enabled) {
      mainWindow?.setAlwaysOnTop(true, 'floating')
      mainWindow?.setSkipTaskbar(true)
      mainWindow?.webContents.send('overlay:changed', true)
      showTriggerWindow()
    } else {
      mainWindow?.setAlwaysOnTop(store.get('alwaysOnTop'))
      mainWindow?.setSkipTaskbar(false)
      mainWindow?.webContents.send('overlay:changed', false)
      hideTriggerWindow()
      // Restore main window if it was hidden
      if (!mainWindow?.isVisible()) {
        mainWindow?.show()
        mainWindow?.focus()
      }
    }
  })

  // Lua export (#23)
  ipcMain.handle('exportLua', () => {
    const rows = getAllTooltipData(db)
    return buildLua(rows)
  })

  ipcMain.handle('writeLua', () => {
    const wow_path = store.get('wow_path')
    if (!wow_path) return { ok: false, error: 'No WoW folder configured in Settings.' }
    try {
      const rows = getAllTooltipData(db)
      const lua = buildLua(rows)
      writeLuaFile(lua, wow_path)
      return { ok: true, path: resolveAddonDataPath(wow_path) }
    } catch (err: any) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  })

  // Playwright on-demand install (#24)
  // In packaged mode worker.exe bundles Python+playwright and handles install
  // itself via --check-playwright / --install-playwright CLI args, so no
  // system Python is required.  In dev mode we fall back to system Python.
  ipcMain.handle('isPlaywrightInstalled', (): boolean => {
    try {
      const { execFileSync } = require('child_process') as typeof import('child_process')
      if (app.isPackaged) {
        const workerPath = join(process.resourcesPath, 'worker.exe')
        execFileSync(workerPath, ['--check-playwright'], { stdio: 'pipe', timeout: 15_000 })
      } else {
        const py = findPython()
        execFileSync(py, ['-m', 'playwright', 'install', '--dry-run', 'chromium'], {
          stdio: 'pipe',
          timeout: 10_000,
        })
      }
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('installPlaywright', async () => {
    const { spawn } = require('child_process') as typeof import('child_process')

    // Helper: run a child and stream plain-text lines as progress events
    const runTextStep = (cmd: string, args: string[], basePercent: number, maxPercent: number) =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
        let stepPercent = basePercent
        const parseProgress = (text: string) => {
          const line = text.trim()
          if (!line) return
          const pctMatch = line.match(/(\d+)%/)
          if (pctMatch) {
            const inner = parseInt(pctMatch[1], 10)
            stepPercent = basePercent + Math.round((inner / 100) * (maxPercent - basePercent))
          } else {
            stepPercent = Math.min(stepPercent + 1, maxPercent - 1)
          }
          mainWindow?.webContents.send('playwright:progress', { percent: stepPercent, message: line })
        }
        let buf = ''
        child.stdout?.on('data', (chunk: Buffer) => {
          buf += chunk.toString()
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          lines.forEach(parseProgress)
        })
        child.stderr?.on('data', (chunk: Buffer) => {
          chunk.toString().split('\n').forEach(parseProgress)
        })
        child.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`Process exited with code ${code}`))
        })
        child.on('error', reject)
      })

    if (app.isPackaged) {
      // worker.exe has playwright bundled — it downloads chromium directly,
      // emitting JSON progress events on stdout.
      const workerPath = join(process.resourcesPath, 'worker.exe')
      mainWindow?.webContents.send('playwright:progress', { percent: 0, message: 'Preparing Chromium download…' })
      await new Promise<void>((resolve, reject) => {
        const child = spawn(workerPath, ['--install-playwright'], { stdio: ['ignore', 'pipe', 'pipe'] })
        let buf = ''
        child.stdout?.on('data', (chunk: Buffer) => {
          buf += chunk.toString()
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
              const event = JSON.parse(trimmed)
              if (event.type === 'progress') {
                mainWindow?.webContents.send('playwright:progress', {
                  percent: event.percent ?? 50,
                  message: event.message ?? '',
                })
              } else if (event.type === 'done') {
                mainWindow?.webContents.send('playwright:progress', { percent: 100, message: event.message ?? 'Done.' })
              } else if (event.type === 'error') {
                reject(new Error(event.message))
              }
            } catch (_) {
              // non-JSON line — ignore
            }
          }
        })
        child.stderr?.on('data', (chunk: Buffer) => {
          process.stdout.write(`[playwright-install] ${chunk.toString()}`)
        })
        child.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`Installation exited with code ${code}`))
        })
        child.on('error', reject)
      })
    } else {
      // Dev mode: use system Python
      const py = findPython()
      mainWindow?.webContents.send('playwright:progress', { percent: 0, message: 'Installing playwright Python package…' })
      await runTextStep(py, ['-m', 'pip', 'install', '--upgrade', 'playwright'], 0, 30)
      mainWindow?.webContents.send('playwright:progress', { percent: 30, message: 'Downloading Chromium browser…' })
      await runTextStep(py, ['-m', 'playwright', 'install', 'chromium'], 30, 100)
      mainWindow?.webContents.send('playwright:progress', { percent: 100, message: 'Chromium installed successfully.' })
    }
  })
}

app.whenReady().then(() => {
  db = initDb(join(app.getPath('userData'), 'simdragosa.db'))
  migrateItemNames(db)
  registerIpcHandlers()
  registerTriggerIpc()
  createWindow()
  createTriggerWindow(mainWindow!, store)
  createTray(mainWindow!, store)
  setupAutoUpdater(mainWindow!)
  if (store.get('alwaysOnTop')) mainWindow!.setAlwaysOnTop(true)
  if (store.get('overlayMode')) {
    mainWindow!.setAlwaysOnTop(true, 'floating')
    mainWindow!.setSkipTaskbar(true)
    showTriggerWindow()
  }

  // Start SimC export watcher if enabled and wow_path is configured
  const wowPath = store.get('wow_path')
  if (store.get('watchSimcExports') && wowPath && mainWindow) {
    startWatcher(
      wowPath,
      mainWindow,
      () => store.get('simcSeenTimestamps'),
      (ts) => store.set('simcSeenTimestamps', ts),
    )
  }
})

app.on('before-quit', () => {
  ;(app as any)._quitting = true
  cancelAllWorkers()
  stopWatcher()
  destroyTray()
  destroyTriggerWindow()
})

app.on('window-all-closed', () => {
  // Windows: keep alive in tray; quit only via tray Quit menu
  if (process.platform === 'darwin') app.quit()
})
