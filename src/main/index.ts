import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { initDb, getCharacters, upsertCharacter, deleteCharacter, getAllTooltipData, upsertTooltipRows } from './db'
import { buildLua, writeLuaFile } from './lua-export'
import { spawnWorker, cancelAllWorkers, type JobSpec } from './sim-runner'
import { createTray, destroyTray } from './tray'
import { setupAutoUpdater } from './updater'
import type { Character, Settings, SimSelection } from '../shared/ipc'

interface StoreSchema {
  raidsid: string
  wow_path: string
  windowBounds: { width: number; height: number; x?: number; y?: number }
  alwaysOnTop: boolean
}

const store = new Store<StoreSchema>({
  defaults: {
    raidsid: '',
    wow_path: '',
    windowBounds: { width: 1200, height: 800 },
    alwaysOnTop: false,
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

  // Lua export (#23)
  ipcMain.handle('exportLua', () => {
    const rows = getAllTooltipData(db)
    return buildLua(rows)
  })

  // Playwright placeholders (#24)
  ipcMain.handle('isPlaywrightInstalled', () => false)
  ipcMain.handle('installPlaywright', () => { /* implemented in #24 */ })
}

app.whenReady().then(() => {
  db = initDb(join(app.getPath('userData'), 'simdragosa.db'))
  registerIpcHandlers()
  createWindow()
  createTray(mainWindow!, store)
  setupAutoUpdater(mainWindow!)
  if (store.get('alwaysOnTop')) mainWindow!.setAlwaysOnTop(true)
})

app.on('before-quit', () => {
  ;(app as any)._quitting = true
  cancelAllWorkers()
  destroyTray()
})

app.on('window-all-closed', () => {
  // Windows: keep alive in tray; quit only via tray Quit menu
  if (process.platform === 'darwin') app.quit()
})
