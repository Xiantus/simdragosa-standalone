// src/main/sim-runner.ts
// Spawns python/worker.py (dev) or worker.exe (prod), writes the job spec to
// stdin, parses line-delimited JSON from stdout, and pushes IPC events to the
// renderer window.  One ChildProcess per job; all active processes are tracked
// so they can be killed on cancelJobs().

import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import type { Character, JobUpdate, JobDone, JobError, SimSelection } from '../shared/ipc'
import { upsertJobResult } from './db'

export interface JobSpec {
  type: 'raidbots' | 'qe'
  job_id: string
  character: Character
  difficulty: string
  build_label: string
  talent_code: string | null
  raidsid: string
  raidbots_api_key: null
  timeout_minutes: number
}

const activeWorkers = new Map<string, ChildProcess>()

export function findPython(): string {
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
  const userProfile = process.env['USERPROFILE'] ?? ''

  // On Windows, 'python' and 'python3' are often Store aliases that silently
  // launch the Windows Store installer as a background process and never exit.
  // Skip them entirely and prefer explicit paths + the py launcher.
  const candidates: string[] = [
    // Windows Python Launcher — works correctly when Python is installed
    'py',
    // Explicit versioned names (not Store aliases)
    'python3.13', 'python3.12', 'python3.11', 'python3.10',
  ]

  // Explicit Windows installation paths (never Store aliases)
  for (const ver of ['313', '312', '311', '310']) {
    candidates.push(`${localAppData}\\Programs\\Python\\Python${ver}\\python.exe`)
    candidates.push(`${programFiles}\\Python${ver}\\python.exe`)
  }
  // Conda / Miniconda
  for (const dir of ['miniconda3', 'miniconda', 'anaconda3', 'anaconda']) {
    candidates.push(`${userProfile}\\${dir}\\python.exe`)
    candidates.push(`C:\\${dir}\\python.exe`)
  }

  const storeDir = `${localAppData}\\Microsoft\\WindowsApps`.toLowerCase()

  for (const cmd of candidates) {
    try {
      const r = spawnSync(cmd, ['--version'], { timeout: 3000, stdio: 'pipe' })
      const out = (r.stdout?.toString() ?? '') + (r.stderr?.toString() ?? '')
      if (r.status !== 0 || !/Python \d/.test(out)) continue
      // Double-check the resolved path isn't a Store alias
      const which = spawnSync('where', [cmd], { timeout: 2000, stdio: 'pipe' })
      const resolved = which.stdout?.toString().split('\n')[0].trim().toLowerCase() ?? ''
      if (resolved.includes(storeDir)) continue
      return cmd
    } catch (_) {}
  }

  throw new Error(
    'Python not found. Install Python 3.10+ from python.org and ensure it is on your PATH.'
  )
}

function getWorkerPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'worker.exe')
  }
  return join(app.getAppPath(), 'python', 'worker.py')
}

export function spawnWorker(
  spec: JobSpec,
  win: BrowserWindow,
  db: any,
  onDone?: (dpsGains: any[], charName: string, specName: string, difficulty: string) => void
): void {
  const workerPath = getWorkerPath()
  const isPackaged = app.isPackaged

  let proc: ChildProcess
  if (isPackaged) {
    proc = spawn(workerPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
  } else {
    const pythonExe = findPython()
    proc = spawn(pythonExe, [workerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: join(app.getAppPath(), 'python'),
    })
  }

  activeWorkers.set(spec.job_id, proc)

  // Write job spec to stdin then close it
  proc.stdin!.write(JSON.stringify(spec) + '\n')
  proc.stdin!.end()

  // Parse stdout line by line
  let buffer = ''
  let receivedDoneOrError = false
  proc.stdout!.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const event = JSON.parse(trimmed)
        if (event.type === 'done' || event.type === 'error') receivedDoneOrError = true
        handleWorkerEvent(spec, event, win, db, onDone)
      } catch (_) {
        console.warn(`[worker ${spec.job_id}] non-JSON stdout:`, trimmed)
      }
    }
  })

  let stderrLog = ''
  proc.stderr!.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    process.stdout.write(`[worker ${spec.job_id}] ${text}`)
    stderrLog += text
  })

  proc.on('close', (code) => {
    activeWorkers.delete(spec.job_id)
    // If exited non-zero and we never received a done/error event, emit error
    if (code !== 0 && !receivedDoneOrError && win && !win.isDestroyed()) {
      const detail = stderrLog.trim()
      const message = detail
        ? `Worker process exited with code ${code}\n\n${detail}`
        : `Worker process exited with code ${code}`
      const err: JobError = {
        job_id: spec.job_id,
        message,
      }
      win.webContents.send('job:error', err)
    }
  })
}

function handleWorkerEvent(
  spec: JobSpec,
  event: any,
  win: BrowserWindow,
  db: any,
  onDone?: (dpsGains: any[], charName: string, specName: string, difficulty: string) => void
): void {
  if (!win || win.isDestroyed()) return

  if (event.type === 'progress') {
    const update: JobUpdate = {
      job_id: spec.job_id,
      status: event.status,
      sim_id: event.sim_id,
    }
    win.webContents.send('job:update', update)

  } else if (event.type === 'done') {
    const done: JobDone = {
      job_id: spec.job_id,
      url: event.url,
      dps_gains: event.dps_gains ?? [],
    }
    win.webContents.send('job:done', done)
    // Persist result to DB (include all fields needed to restore the UI on next launch)
    const key = `${spec.character.id}|${spec.difficulty}|${spec.build_label}`
    const record = {
      job_id: spec.job_id,
      char_id: spec.character.id,
      char_name: spec.character.name,
      spec: spec.character.spec,
      difficulty: spec.difficulty,
      build_label: spec.build_label,
      url: event.url,
      status: 'done',
      dps_gains: event.dps_gains ?? [],
      ended_at: Date.now(),
    }
    try { upsertJobResult(db, key, record, record) } catch (_) {}
    if (onDone) onDone(event.dps_gains ?? [], spec.character.name, spec.character.spec, spec.difficulty)

  } else if (event.type === 'error') {
    const err: JobError = {
      job_id: spec.job_id,
      message: event.message,
    }
    win.webContents.send('job:error', err)
    // Persist failed result
    const key = `${spec.character.id}|${spec.difficulty}|${spec.build_label}`
    try {
      upsertJobResult(db, key, { job_id: spec.job_id, status: 'error', message: event.message }, null)
    } catch (_) {}
  }
}

export function cancelAllWorkers(): void {
  for (const [, proc] of activeWorkers) {
    try { proc.kill('SIGTERM') } catch (_) {}
  }
  activeWorkers.clear()
}
