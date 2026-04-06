const { app, BrowserWindow } = require('electron')
const { findFreePort } = require('./port')

let mainWindow = null

async function createWindow() {
  const port = await findFreePort()
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  })

  // Placeholder — will load backend in issue #6
  mainWindow.loadURL(`http://localhost:${port}`)
  mainWindow.once('ready-to-show', () => mainWindow.show())
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
