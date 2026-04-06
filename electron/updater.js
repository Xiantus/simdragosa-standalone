const { autoUpdater } = require('electron-updater')
const { dialog, app } = require('electron')

function setupAutoUpdater(mainWindow) {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', () => {
    console.log('[updater] Update available, downloading...')
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of Simdragosa has been downloaded.',
      detail: 'Restart now to apply the update.',
      buttons: ['Restart', 'Later'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message)
  })

  // Check for updates after a short delay (don't block startup)
  setTimeout(() => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[updater] Check failed:', err.message)
      })
    }
  }, 3000)
}

function checkForUpdatesManually(mainWindow) {
  if (!app.isPackaged) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Dev Mode',
      message: 'Auto-update is disabled in development mode.',
      buttons: ['OK']
    })
    return
  }
  autoUpdater.checkForUpdates().catch(err => {
    dialog.showErrorBox('Update Check Failed', err.message)
  })
}

module.exports = { setupAutoUpdater, checkForUpdatesManually }
