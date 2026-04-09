/**
 * wow-monitor.ts — Watches the Windows foreground window and fires a callback
 * whenever the active process changes.  Used to show the trigger button only
 * while WoW (or Simdragosa itself) is in the foreground.
 *
 * Runs a single persistent PowerShell process in a tight sleep-loop rather
 * than spawning a new process on every poll, keeping overhead low.
 */

import { spawn, ChildProcess } from 'child_process'

// WoW retail / classic / beta / ptr executable names (lowercase, no .exe)
const WOW_PROCS = new Set(['wow', 'wowclassic', 'wowclassicb', 'wowb', 'wowptr'])

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

let psProc: ChildProcess | null = null
let _callback: ((isWow: boolean, procName: string) => void) | null = null
let _buf = ''

export function startWowMonitor(onForegroundChange: (isWow: boolean, procName: string) => void): void {
  if (psProc) return // already running
  _callback = onForegroundChange

  psProc = spawn('powershell', [
    '-NoProfile', '-NoLogo', '-NonInteractive', '-Command', PS_SCRIPT,
  ], { stdio: ['ignore', 'pipe', 'ignore'] })

  psProc.stdout?.on('data', (chunk: Buffer) => {
    _buf += chunk.toString()
    const lines = _buf.split('\n')
    _buf = lines.pop() ?? ''
    for (const line of lines) {
      const name = line.trim()
      if (!name) continue
      const isWow = WOW_PROCS.has(name.toLowerCase())
      _callback?.(isWow, name)
    }
  })

  psProc.on('exit', () => { psProc = null })
}

export function stopWowMonitor(): void {
  psProc?.kill()
  psProc = null
  _callback = null
}
