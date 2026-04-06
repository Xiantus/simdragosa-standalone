const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { findFreePort } = require('./port')
const { createTray } = require('./tray')
const { setupAutoUpdater } = require('./updater')
const { spawn, spawnSync } = require('child_process')
const path = require('path')
const http = require('http')
const Store = require('electron-store')

let mainWindow = null
let backendProcess = null
const store = new Store()

const isDev = !app.isPackaged

function getBackendPath() {
  if (isDev) return null
  return path.join(process.resourcesPath, 'backend.exe')
}

// Find the correct Python executable on this machine.
// Tries: py (Windows launcher), python3, python — in that order.
function findPython() {
  const candidates = ['py', 'python3', 'python']
  for (const cmd of candidates) {
    try {
      const result = spawnSync(cmd, ['--version'], { timeout: 3000 })
      if (result.status === 0) {
        console.log(`[backend] Using Python executable: ${cmd}`)
        return cmd
      }
    } catch (_) {}
  }
  throw new Error(
    'Python not found. Please install Python from https://python.org and ensure it is on your PATH.'
  )
}

function spawnBackend(port) {
  if (isDev) {
    const python = findPython()
    backendProcess = spawn(python, ['app.py', '--port', String(port)], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env },
      stdio: 'pipe'
    })
  } else {
    backendProcess = spawn(getBackendPath(), ['--port', String(port)], {
      env: { ...process.env },
      stdio: 'pipe'
    })
  }

  backendProcess.stdout.on('data', (d) => console.log('[backend]', d.toString().trimEnd()))
  backendProcess.stderr.on('data', (d) => console.error('[backend]', d.toString().trimEnd()))
  backendProcess.on('exit', (code) => console.log('[backend] exited with code', code))
}

function waitForBackend(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
        if (res.statusCode === 200) resolve()
        else setTimeout(check, 500)
      }).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('Backend startup timeout'))
        else setTimeout(check, 500)
      })
    }
    check()
  })
}

async function createWindow(port) {
  const bounds = store.get('windowBounds', { width: 1200, height: 800 })

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    alwaysOnTop: store.get('alwaysOnTop', false),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    icon: path.join(__dirname, '..', 'static', 'simdragosa-icon.png')
  })

  process.env.SIMDRAGOSA_PORT = String(port)

  mainWindow.loadURL(`http://127.0.0.1:${port}`)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  createTray(mainWindow, store, app)
  setupAutoUpdater(mainWindow)

  const saveBounds = () => store.set('windowBounds', mainWindow.getBounds())
  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

app.whenReady().then(async () => {
  let port
  try {
    port = await findFreePort()
    spawnBackend(port)
    await waitForBackend(port)
    await createWindow(port)
  } catch (err) {
    dialog.showErrorBox(
      'Simdragosa failed to start',
      `The backend could not be started.\n\n${err.message}\n\nPlease restart the app.`
    )
    app.quit()
  }
})

app.on('before-quit', () => {
  const { destroyTray } = require('./tray'); destroyTray()
  app.isQuiting = true
  if (backendProcess) backendProcess.kill()
})

app.on('window-all-closed', () => {
  // Do not quit — tray keeps app alive
})

module.exports = { getBackendPath, waitForBackend, findPython }
