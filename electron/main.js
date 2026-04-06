const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { findFreePort } = require('./port')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const Store = require('electron-store') // add to package.json dependencies

let mainWindow = null
let backendProcess = null
const store = new Store()

const isDev = !app.isPackaged

function getBackendPath() {
  if (isDev) {
    return null // use Python directly in dev
  }
  return path.join(process.resourcesPath, 'backend.exe')
}

function spawnBackend(port) {
  if (isDev) {
    backendProcess = spawn('python', ['app.py', '--port', String(port)], {
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

  backendProcess.stdout.on('data', (d) => console.log('[backend]', d.toString()))
  backendProcess.stderr.on('data', (d) => console.error('[backend]', d.toString()))
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

  // Inject port for preload
  process.env.SIMDRAGOSA_PORT = String(port)

  mainWindow.loadURL(`http://127.0.0.1:${port}`)
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Save window bounds on resize/move
  const saveBounds = () => store.set('windowBounds', mainWindow.getBounds())
  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  // Close to tray, don't quit
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
  app.isQuiting = true
  if (backendProcess) {
    backendProcess.kill()
  }
})

app.on('window-all-closed', () => {
  // Do not quit — tray keeps app alive
})

module.exports = { getBackendPath, waitForBackend }
