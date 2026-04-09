// src/main/updater.ts
import { autoUpdater } from 'electron-updater'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'

export type UpdateCheckResult =
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; version: string }
  | { status: 'error'; message: string }

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

export function setupAutoUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) {
    console.log('[updater] dev mode — skipping update check')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] update available: ${info.version} — downloading in background`)
  })

  autoUpdater.on('update-downloaded', () => {
    if (!win.isDestroyed()) win.webContents.send('update:ready')
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message)
  })

  const check = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[updater] checkForUpdates failed:', err.message)
    })
  }

  // Delay first check so it doesn't block startup, then repeat every 4 hours
  setTimeout(() => {
    check()
    setInterval(check, CHECK_INTERVAL_MS)
  }, 8000)
}

/** Manually triggered check — resolves with the outcome so the UI can reflect it. */
export function checkForUpdatesNow(): Promise<UpdateCheckResult> {
  if (!app.isPackaged) {
    return Promise.resolve({ status: 'up-to-date', currentVersion: app.getVersion() })
  }

  return new Promise((resolve) => {
    const onAvailable = (info: { version: string }) => {
      cleanup()
      resolve({ status: 'available', version: info.version })
    }
    const onNotAvailable = () => {
      cleanup()
      resolve({ status: 'up-to-date', currentVersion: app.getVersion() })
    }
    const onError = (err: Error) => {
      cleanup()
      resolve({ status: 'error', message: err.message })
    }

    const cleanup = () => {
      autoUpdater.removeListener('update-available', onAvailable)
      autoUpdater.removeListener('update-not-available', onNotAvailable)
      autoUpdater.removeListener('error', onError)
    }

    autoUpdater.once('update-available', onAvailable)
    autoUpdater.once('update-not-available', onNotAvailable)
    autoUpdater.once('error', onError)

    autoUpdater.checkForUpdates().catch((err) => {
      cleanup()
      resolve({ status: 'error', message: err.message })
    })
  })
}
