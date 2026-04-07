/**
 * trigger-window.ts — Floating round icon button for in-game overlay mode.
 *
 * A 56×56 transparent frameless BrowserWindow that stays on screen when the
 * main window is hidden. Left-click-drag moves it; a clean click (< 6px
 * movement) toggles the main window's visibility. Position is persisted.
 */

import { BrowserWindow, ipcMain, screen, nativeImage } from 'electron'
import { join, resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

let triggerWin: BrowserWindow | null = null

// ── icon ──────────────────────────────────────────────────────────────────────

function iconDataUrl(): string {
  // Try static/simdragosa-icon.png relative to app root
  const candidates = [
    join(app_root(), 'static', 'simdragosa-icon.png'),
    join(app_root(), 'resources', 'simdragosa-icon.png'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      const b64 = readFileSync(p).toString('base64')
      return `data:image/png;base64,${b64}`
    }
  }
  // Fallback: simple SVG dragon silhouette as data URL
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="28" fill="#5b4cf5"/>
    <text x="28" y="36" text-anchor="middle" font-size="28" font-family="serif" fill="white">S</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function app_root(): string {
  // Works both in dev (project root) and packaged (resources/app)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    return app.isPackaged ? process.resourcesPath : join(__dirname, '../../..')
  } catch {
    return join(__dirname, '../../..')
  }
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function buildHtml(iconUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; user-select:none; }
  html, body { width:56px; height:56px; background:transparent; overflow:hidden; }
  #btn {
    width:56px; height:56px; border-radius:50%;
    background: rgba(20,18,40,0.92);
    border: 2px solid rgba(120,100,255,0.6);
    box-shadow: 0 2px 12px rgba(0,0,0,0.7);
    cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    transition: border-color 0.15s, box-shadow 0.15s;
    overflow:hidden;
  }
  #btn:hover {
    border-color: rgba(160,140,255,0.9);
    box-shadow: 0 2px 18px rgba(91,76,245,0.6);
  }
  #btn img { width:36px; height:36px; object-fit:contain; border-radius:50%; }
</style>
</head>
<body>
<div id="btn"><img src="${iconUrl}" draggable="false" /></div>
<script>
  const { ipcRenderer } = require('electron')
  const btn = document.getElementById('btn')

  let dragStartX = 0, dragStartY = 0
  let dragging = false
  const DRAG_THRESHOLD = 6

  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    dragStartX = e.screenX
    dragStartY = e.screenY
    dragging = false
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e) => {
    if (e.buttons !== 1) return
    const dx = e.screenX - dragStartX
    const dy = e.screenY - dragStartY
    if (!dragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      dragging = true
    }
    if (dragging) {
      ipcRenderer.send('trigger:move', e.screenX, e.screenY, dragStartX, dragStartY)
    }
  })

  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return
    if (!dragging) {
      ipcRenderer.send('trigger:click')
    } else {
      ipcRenderer.send('trigger:drag-end')
    }
    dragging = false
  })
</script>
</body>
</html>`
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
    alwaysOnTop: false,  // regular window — WoW windowed-fullscreen sits below
    skipTaskbar: true,   // no taskbar entry; lifecycle tied to main window
    resizable: false,
    hasShadow: false,
    focusable: false,    // don't steal keyboard focus from the game
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  triggerWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildHtml(iconDataUrl()))}`)
  triggerWin.hide() // hidden until overlay mode is active

  // Mirror the main window's minimize/restore so the button vanishes
  // when the user minimises Simdragosa and reappears when it's restored.
  mainWin.on('minimize', () => { if (triggerWin?.isVisible()) triggerWin.hide() })
  mainWin.on('restore',  () => { /* show handled by showTriggerWindow() call site */ })
}

export function showTriggerWindow(): void {
  // Only show if the main window is also visible (not minimised)
  if (_mainWin && !_mainWin.isMinimized() && _mainWin.isVisible()) {
    triggerWin?.show()
  }
}

export function hideTriggerWindow(): void {
  triggerWin?.hide()
}

export function destroyTriggerWindow(): void {
  triggerWin?.destroy()
  triggerWin = null
}

// ── IPC ───────────────────────────────────────────────────────────────────────

export function registerTriggerIpc(): void {
  ipcMain.on('trigger:click', () => {
    if (!_mainWin) return
    if (_mainWin.isVisible()) {
      // Hide both — use the tray icon or system taskbar to restore
      _mainWin.hide()
      triggerWin?.hide()
    } else {
      _mainWin.show()
      _mainWin.focus()
      triggerWin?.show()
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
