/**
 * wow-monitor.ts — Watches the foreground window and fires a callback
 * whenever the active process changes. Used to show the trigger button only
 * while WoW (or Simdragosa itself) is in the foreground.
 *
 * Windows: persistent PowerShell process polling Win32 GetForegroundWindow.
 * macOS:   setInterval polling `osascript` for the frontmost app name.
 */

import { spawn, ChildProcess } from 'child_process'
import { spawnSync } from 'child_process'

// WoW retail / classic / beta / ptr executable names (lowercase, no extension).
// macOS process names differ from Windows — WoW runs as "World of Warcraft".
const WOW_PROCS_WIN = new Set(['wow', 'wowclassic', 'wowclassicb', 'wowb', 'wowptr'])
const WOW_PROCS_MAC = new Set(['world of warcraft', 'wowclassic', 'wowb', 'wowptr'])

type ForegroundCallback = (isWow: boolean, procName: string) => void

// ── shared state ──────────────────────────────────────────────────────────────

let _callback: ForegroundCallback | null = null

// ── Windows implementation ────────────────────────────────────────────────────

// Inline PowerShell script: every 500 ms write the foreground window's
// process name to stdout (empty line if we can't determine it).
const PS_SCRIPT = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class FgWin {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint procId);
}
'@
while ($true) {
    try {
        $fgProcId = 0
        [FgWin]::GetWindowThreadProcessId([FgWin]::GetForegroundWindow(), [ref]$fgProcId) | Out-Null
        $name = (Get-Process -Id ([int]$fgProcId) -ErrorAction Stop).Name
        Write-Output $name
    } catch {
        Write-Output ''
    }
    Start-Sleep -Milliseconds 500
}
`

let _psProc: ChildProcess | null = null
let _psBuf = ''

function startWowMonitorWin(cb: ForegroundCallback): void {
  if (_psProc) return
  _callback = cb

  _psProc = spawn('powershell', [
    '-NoProfile', '-NoLogo', '-NonInteractive', '-Command', PS_SCRIPT,
  ], { stdio: ['ignore', 'pipe', 'ignore'] })

  _psProc.stdout?.on('data', (chunk: Buffer) => {
    _psBuf += chunk.toString()
    const lines = _psBuf.split('\n')
    _psBuf = lines.pop() ?? ''
    for (const line of lines) {
      const name = line.trim()
      if (!name) continue
      const isWow = WOW_PROCS_WIN.has(name.toLowerCase())
      _callback?.(isWow, name)
    }
  })

  _psProc.on('exit', () => { _psProc = null })
}

function stopWowMonitorWin(): void {
  _psProc?.kill()
  _psProc = null
  _callback = null
  _psBuf = ''
}

// ── macOS implementation ──────────────────────────────────────────────────────

let _macTimer: ReturnType<typeof setInterval> | null = null

function startWowMonitorMac(cb: ForegroundCallback): void {
  if (_macTimer) return
  _callback = cb

  _macTimer = setInterval(() => {
    try {
      const r = spawnSync('osascript', [
        '-e', 'tell application "System Events" to get name of first process where it is frontmost',
      ], { timeout: 1000, stdio: 'pipe' })
      const name = r.stdout?.toString().trim() ?? ''
      if (!name) return
      const isWow = WOW_PROCS_MAC.has(name.toLowerCase())
      _callback?.(isWow, name)
    } catch (_) {}
  }, 500)
}

function stopWowMonitorMac(): void {
  if (_macTimer) clearInterval(_macTimer)
  _macTimer = null
  _callback = null
}

// ── public API ────────────────────────────────────────────────────────────────

export function startWowMonitor(onForegroundChange: ForegroundCallback): void {
  if (process.platform === 'darwin') {
    startWowMonitorMac(onForegroundChange)
  } else {
    startWowMonitorWin(onForegroundChange)
  }
}

export function stopWowMonitor(): void {
  if (process.platform === 'darwin') {
    stopWowMonitorMac()
  } else {
    stopWowMonitorWin()
  }
}
