// src/main/tray.ts
import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import type { BrowserWindow } from 'electron'

let tray: Tray | null = null

function loadIcon(): Electron.NativeImage {
  try {
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'static', 'simdragosa-icon.png')
      : join(app.getAppPath(), 'static', 'simdragosa-icon.png')
    const img = nativeImage.createFromPath(iconPath)
    if (!img.isEmpty()) return img
  } catch (_) {}
  // Minimal 1x1 transparent PNG fallback so tray never crashes
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  )
}

export function createTray(win: BrowserWindow, store: any): Tray {
  tray = new Tray(loadIcon())
  tray.setToolTip('Simdragosa')

  const buildMenu = () =>
    Menu.buildFromTemplate([
      {
        label: 'Show / Hide',
        click: () => {
          if (win.isVisible()) { win.hide() }
          else { win.show(); win.focus() }
        },
      },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: Boolean(store.get('alwaysOnTop')),
        click: (item: Electron.MenuItem) => {
          store.set('alwaysOnTop', item.checked)
          win.setAlwaysOnTop(item.checked)
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.quit() } },
    ])

  tray.setContextMenu(buildMenu())

  tray.on('click', () => {
    tray?.setContextMenu(buildMenu())
    if (win.isVisible()) win.focus()
    else { win.show(); win.focus() }
  })

  tray.on('right-click', () => {
    tray?.setContextMenu(buildMenu())
    tray?.popUpContextMenu()
  })

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
