import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { initDb, getCharacters, upsertCharacter, deleteCharacter, getAllTooltipData, upsertTooltipRows } from './db'
import { buildLua, writeLuaFile } from './lua-export'
import { spawnWorker, cancelAllWorkers, findPython, type JobSpec } from './sim-runner'
import { createTray, destroyTray } from './tray'
import { setupAutoUpdater } from './updater'
import { createTriggerWindow, showTriggerWindow, hideTriggerWindow, destroyTriggerWindow, registerTriggerIpc } from './trigger-window'
import type { Character, Settings, SimSelection } from '../shared/ipc'

interface StoreSchema {
  raidsid: string
  wow_path: string
  windowBounds: { width: number; height: number; x?: number; y?: number }
  alwaysOnTop: boolean
  overlayMode: boolean
  triggerPosition: { x: number; y: number }
}

const store = new Store<StoreSchema>({
  defaults: {
    raidsid: '',
    wow_path: '',
    windowBounds: { width: 1200, height: 800 },
    alwaysOnTop: false,
    overlayMode: false,
    triggerPosition: { x: 120, y: 120 },
  },
})

const HEALER_SPEC_IDS = new Set([65, 105, 256, 257, 264, 270, 1468])

let mainWindow: BrowserWindow | null = null
let db: ReturnType<typeof initDb>

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

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  ipcMain.on('window:minimize', () => mainWindow?.minimize())
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
  }))
  ipcMain.handle('saveSettings', (_event, partial: Partial<Settings>) => {
    if (partial.raidsid !== undefined) store.set('raidsid', partial.raidsid)
    if (partial.wow_path !== undefined) store.set('wow_path', partial.wow_path)
  })

  // Sim launch (#21)
  ipcMain.handle('startSim', async (_event, selection: SimSelection) => {
    const raidsid = store.get('raidsid')
    if (!raidsid) throw new Error('No raidsid configured')
    const characters = getCharacters(db)
    const charMap = new Map(characters.map((c) => [c.id, c]))

    for (const charId of selection.character_ids) {
      const char = charMap.get(charId)
      if (!char) continue
      for (const difficulty of selection.difficulties) {
        const job_id = `${charId}-${difficulty}-${Date.now()}`
        const spec: JobSpec = {
          type: HEALER_SPEC_IDS.has(char.spec_id) ? 'qe' : 'raidbots',
          job_id,
          character: char,
          difficulty,
          build_label: 'Default',
          talent_code: null,
          raidsid,
          raidbots_api_key: null,
          timeout_minutes: 30,
        }
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
  })
  ipcMain.handle('cancelJobs', () => cancelAllWorkers())

  // Overlay mode
  ipcMain.handle('getOverlayMode', () => store.get('overlayMode'))
  ipcMain.handle('setOverlayMode', (_event, enabled: boolean) => {
    store.set('overlayMode', enabled)
    if (enabled) {
      mainWindow?.setAlwaysOnTop(true, 'screen-saver')
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

  // Playwright on-demand install (#24)
  // Uses Python playwright to drive Raidbots; check/install via `python -m playwright`
  ipcMain.handle('isPlaywrightInstalled', (): boolean => {
    try {
      const { execFileSync } = require('child_process') as typeof import('child_process')
      const py = findPython()
      // `python -m playwright install --dry-run chromium` exits 0 when already installed
      execFileSync(py, ['-m', 'playwright', 'install', '--dry-run', 'chromium'], {
        stdio: 'pipe',
        timeout: 10_000,
      })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('installPlaywright', async () => {
    const { spawn } = require('child_process') as typeof import('child_process')
    const py = findPython()

    // Helper: run a child process and stream output as progress events
    const runStep = (args: string[], basePercent: number, maxPercent: number) =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(py, args, { stdio: ['ignore', 'pipe', 'pipe'] })

        let stepPercent = basePercent
        const parseProgress = (text: string) => {
          const line = text.trim()
          if (!line) return
          const pctMatch = line.match(/(\d+)%/)
          if (pctMatch) {
            // Scale inner percentage into our range
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
          else reject(new Error(`${args.join(' ')} exited with code ${code}`))
        })
        child.on('error', reject)
      })

    // Step 1 (0–30%): pip install playwright (installs the Python package)
    mainWindow?.webContents.send('playwright:progress', { percent: 0, message: 'Installing playwright Python package…' })
    await runStep(['-m', 'pip', 'install', '--upgrade', 'playwright'], 0, 30)

    // Step 2 (30–100%): playwright install chromium (downloads the browser)
    mainWindow?.webContents.send('playwright:progress', { percent: 30, message: 'Downloading Chromium browser…' })
    await runStep(['-m', 'playwright', 'install', 'chromium'], 30, 100)

    mainWindow?.webContents.send('playwright:progress', { percent: 100, message: 'Chromium installed successfully.' })
  })
}

app.whenReady().then(() => {
  db = initDb(join(app.getPath('userData'), 'simdragosa.db'))
  registerIpcHandlers()
  registerTriggerIpc()
  createWindow()
  createTriggerWindow(mainWindow!, store)
  createTray(mainWindow!, store)
  setupAutoUpdater(mainWindow!)
  if (store.get('alwaysOnTop')) mainWindow!.setAlwaysOnTop(true)
  if (store.get('overlayMode')) {
    mainWindow!.setAlwaysOnTop(true, 'screen-saver')
    mainWindow!.setSkipTaskbar(true)
    showTriggerWindow()
  }
})

app.on('before-quit', () => {
  ;(app as any)._quitting = true
  cancelAllWorkers()
  destroyTray()
  destroyTriggerWindow()
})

app.on('window-all-closed', () => {
  // Windows: keep alive in tray; quit only via tray Quit menu
  if (process.platform === 'darwin') app.quit()
})
