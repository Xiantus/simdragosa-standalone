import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { initDb, getCharacters, upsertCharacter, deleteCharacter } from './db'
import type { Character, Settings } from '../shared/ipc'

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
  mainWindow.on('close', () => {
    if (mainWindow) store.set('windowBounds', mainWindow.getBounds())
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
  ipcMain.on('window:close', () => mainWindow?.close())
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

  // Placeholders for later issues
  ipcMain.handle('startSim', () => { /* #21 */ })
  ipcMain.handle('cancelJobs', () => { /* #21 */ })
  ipcMain.handle('exportLua', () => '') // #23
  ipcMain.handle('isPlaywrightInstalled', () => false) // #24
  ipcMain.handle('installPlaywright', () => { /* #24 */ })
}

app.whenReady().then(() => {
  db = initDb(join(app.getPath('userData'), 'simdragosa.db'))
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
