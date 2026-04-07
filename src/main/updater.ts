// src/main/updater.ts
import { autoUpdater } from 'electron-updater'
import { app, dialog } from 'electron'
import type { BrowserWindow } from 'electron'

export function setupAutoUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) {
    console.log('[updater] dev mode — skipping update check')
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox(win, {
        type: 'info',
        title: 'Update Available',
        message: `Simdragosa ${info.version} is available. Download now?`,
        buttons: ['Download', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate()
      })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox(win, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. Restart now to apply?',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message)
  })

  // Delay first check so it doesn't block startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[updater] checkForUpdates failed:', err.message)
    })
  }, 8000)
}
