/**
 * trigger-window.ts — Floating round icon button for in-game overlay mode.
 *
 * A 56×56 transparent frameless BrowserWindow that stays on screen when the
 * main window is hidden. Left-click-drag moves it; a clean click (< 6px
 * movement) toggles the main window's visibility. Position is persisted.
 */

import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { startWowMonitor, stopWowMonitor } from './wow-monitor'

let triggerWin: BrowserWindow | null = null

function app_root(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron')
  // In dev, compiled output is at out/main/ — two levels up is the project root
  return app.isPackaged ? process.resourcesPath : join(__dirname, '../..')
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

let _store: any = null
let _mainWin: BrowserWindow | null = null
// Track window origin at drag start
let _winAtDragStart: { x: number; y: number } | null = null

export function createTriggerWindow(mainWin: BrowserWindow, store: any): void {
  _store = store
  _mainWin = mainWin

  const pos = store.get('triggerPosition', { x: 120, y: 120 }) as { x: number; y: number }

  triggerWin = new BrowserWindow({
    width: 56,
    height: 56,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // fully transparent — prevents white/grey square on Windows
    alwaysOnTop: true,   // TOPMOST so it floats above WoW; hidden when non-WoW app focused
    skipTaskbar: true,   // no taskbar entry; lifecycle tied to main window
    resizable: false,
    hasShadow: false,
    focusable: false,    // don't steal keyboard focus from the game
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // Load from a real file so the icon <img src> can resolve relative paths
  triggerWin.loadFile(join(app_root(), 'static', 'trigger.html'))
  triggerWin.hide() // hidden until overlay mode is active

  // Mirror the main window's minimize/restore so the button vanishes
  // when the user minimises Simdragosa and reappears when it's restored.
  mainWin.on('minimize', () => {
    _mainMinimized = true
    triggerWin?.hide()
  })
  mainWin.on('restore', () => {
    _mainMinimized = false
    // The monitor's next tick will show the trigger if the foreground is WoW/Electron
  })
}

// Track whether overlay mode is active (monitor should be running)
let _overlayActive = false
// True while the user has minimised the main window via the OS minimize button
let _mainMinimized = false

export function showTriggerWindow(): void {
  _overlayActive = true

  // Start the foreground-window monitor.  The trigger button is TOPMOST but we
  // only make it visible when WoW (or Simdragosa itself) is in the foreground.
  // startWowMonitor is idempotent — safe to call multiple times.
  startWowMonitor((isWow, procName) => {
    if (!_overlayActive || !triggerWin) return

    // Don't show the trigger if the user minimised the main window via OS chrome
    if (_mainMinimized) {
      if (triggerWin.isVisible()) triggerWin.hide()
      return
    }

    // Also consider Simdragosa's own process as "allowed"
    const { app } = require('electron') as typeof import('electron')
    const ownExe = app.isPackaged
      ? process.execPath.replace(/\\/g, '/').split('/').pop()!.replace(/\.exe$/i, '').toLowerCase()
      : 'electron'

    const nameLc = procName.toLowerCase()
    const allowed = isWow || nameLc === ownExe || nameLc === 'electron'

    if (allowed) {
      if (!triggerWin.isVisible()) triggerWin.show()
    } else {
      if (triggerWin.isVisible()) triggerWin.hide()
    }
  })
}

export function hideTriggerWindow(): void {
  _overlayActive = false
  stopWowMonitor()
  triggerWin?.hide()
}

export function destroyTriggerWindow(): void {
  _overlayActive = false
  stopWowMonitor()
  triggerWin?.destroy()
  triggerWin = null
}

// ── IPC ───────────────────────────────────────────────────────────────────────

export function registerTriggerIpc(): void {
  ipcMain.on('trigger:click', () => {
    if (!_mainWin) return
    if (_mainWin.isVisible()) {
      // Hide only the main window; trigger button stays visible so the user
      // can click it again to bring the main window back.
      _mainWin.hide()
    } else {
      _mainWin.show()
      _mainWin.focus()
    }
  })

  ipcMain.on('trigger:move', (_e, screenX: number, screenY: number, startX: number, startY: number) => {
    if (!triggerWin) return
    if (!_winAtDragStart) {
      _winAtDragStart = { x: triggerWin.getPosition()[0], y: triggerWin.getPosition()[1] }
    }
    const newX = _winAtDragStart.x + (screenX - startX)
    const newY = _winAtDragStart.y + (screenY - startY)

    // Clamp to screen bounds
    const display = screen.getDisplayNearestPoint({ x: newX, y: newY })
    const { x: sx, y: sy, width: sw, height: sh } = display.workArea
    const cx = Math.min(Math.max(newX, sx), sx + sw - 56)
    const cy = Math.min(Math.max(newY, sy), sy + sh - 56)

    triggerWin.setPosition(cx, cy)
  })

  ipcMain.on('trigger:drag-end', () => {
    _winAtDragStart = null
    if (!triggerWin || !_store) return
    const [x, y] = triggerWin.getPosition()
    _store.set('triggerPosition', { x, y })
  })
}
