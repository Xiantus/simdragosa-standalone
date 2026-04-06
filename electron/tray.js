const { Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { checkForUpdatesManually } = require('./updater')

let tray = null

function createTray(mainWindow, store, app) {
  const iconPath = path.join(__dirname, '..', 'static', 'simdragosa-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Simdragosa')

  function buildMenu() {
    const isVisible = mainWindow.isVisible()
    const isOnTop = mainWindow.isAlwaysOnTop()

    return Menu.buildFromTemplate([
      {
        label: isVisible ? 'Hide' : 'Show',
        click: () => {
          isVisible ? mainWindow.hide() : mainWindow.show()
          tray.setContextMenu(buildMenu())
        }
      },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: isOnTop,
        click: () => {
          const next = !mainWindow.isAlwaysOnTop()
          mainWindow.setAlwaysOnTop(next)
          store.set('alwaysOnTop', next)
          tray.setContextMenu(buildMenu())
        }
      },
      {
        label: 'Check for Updates',
        click: () => checkForUpdatesManually(mainWindow)
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuiting = true
          app.quit()
        }
      }
    ])
  }

  tray.setContextMenu(buildMenu())

  // Left-click toggles visibility
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    tray.setContextMenu(buildMenu())
  })

  return tray
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

module.exports = { createTray, destroyTray }
