import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { initDb, getCharacters, upsertCharacter, deleteCharacter } from './db'
import type { Character } from '../shared/ipc'

let mainWindow: BrowserWindow | null = null
let db: ReturnType<typeof initDb>

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
  ipcMain.handle('getCharacters', () => getCharacters(db))
  ipcMain.handle('upsertCharacter', (_event, char: Character) => {
    if (!char.id) {
      char.id = `${char.name.toLowerCase()}-${char.spec.toLowerCase()}`
    }
    upsertCharacter(db, char)
  })
  ipcMain.handle('deleteCharacter', (_event, id: string) => deleteCharacter(db, id))
}

app.whenReady().then(() => {
  db = initDb(join(app.getPath('userData'), 'simdragosa.db'))
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
