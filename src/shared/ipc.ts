// src/shared/ipc.ts
// Shared TypeScript interfaces for the Electron IPC contract.
// Both main process and renderer import from here — mismatches are caught at build time.

export interface Character {
  id: string
  name: string
  realm: string
  region: string
  spec: string
  spec_id: number
  loot_spec_id: number
  simc_string: string
  crafted_stats: string
  ilvl?: number
  exclude_from_item_updates?: boolean
}

export interface Settings {
  raidsid: string
  wow_path: string
  is_configured: boolean
}

export interface SimSelection {
  character_ids: string[]
  difficulties: string[]
}

export type JobStatus =
  | 'queued'
  | 'fetching'
  | 'submitting'
  | 'running'
  | 'done'
  | 'error'
  | 'cancelled'
  | 'skipped'

export interface Job {
  job_id: string
  char_id: string
  char_name: string
  difficulty: string
  build_label: string
  status: JobStatus
  sim_id?: string
  url?: string
  log_lines: string[]
  started_at: number
  ended_at?: number
}

export interface DpsGain {
  item_id: number
  dps_gain: number
  ilvl: number | null
  item_name?: string | null
}

export interface StoredResult {
  job_id: string
  char_id: string
  char_name: string
  spec?: string
  difficulty: string
  build_label: string
  status: 'done' | 'error'
  url?: string
  dps_gains?: DpsGain[]
  ended_at?: number
  error_message?: string
}

export interface JobUpdate {
  job_id: string
  status: JobStatus
  sim_id?: string
  log_line?: string
}

export interface JobDone {
  job_id: string
  url: string
  dps_gains: DpsGain[]
}

export interface JobError {
  job_id: string
  message: string
}

export interface JobQueued {
  job_id: string
  char_id: string
  char_name: string
  spec: string
  difficulty: string
  build_label: string
}

export interface PlaywrightProgress {
  percent: number
  message: string
}

export interface SimcExportDetected {
  charKey: string   // "CharName-Realm"
  spec: string      // e.g. "frost"
  simc: string      // full SimC profile string
  timestamp: number // Unix seconds from the addon
}

// The full API exposed on window.api via contextBridge
export interface ElectronAPI {
  // Renderer → Main (invoke/handle)
  getCharacters: () => Promise<Character[]>
  upsertCharacter: (char: Omit<Character, 'id'> & { id?: string }) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
  getSettings: () => Promise<Settings>
  saveSettings: (partial: Partial<Settings>) => Promise<void>
  getJobResults: () => Promise<StoredResult[]>
  fetchItemNames: (itemIds: number[]) => Promise<Record<number, { name: string; icon?: string | null; source?: string | null }>>
  checkForUpdates: () => Promise<
    | { status: 'up-to-date'; currentVersion: string }
    | { status: 'available'; version: string }
    | { status: 'error'; message: string }
  >
  writeLua: () => Promise<{ ok: boolean; path?: string; error?: string }>
  startSim: (selections: SimSelection) => Promise<JobQueued[]>
  cancelJobs: () => Promise<void>
  exportLua: () => Promise<string>
  installPlaywright: () => Promise<void>
  isPlaywrightInstalled: () => Promise<boolean>

  // Window controls
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void

  // Overlay mode
  getOverlayMode: () => Promise<boolean>
  setOverlayMode: (enabled: boolean) => Promise<void>
  onOverlayChanged: (cb: (enabled: boolean) => void) => () => void

  // Main → Renderer (push events — return unsubscribe function)
  onJobUpdate: (callback: (update: JobUpdate) => void) => () => void
  onJobDone: (callback: (done: JobDone) => void) => () => void
  onJobError: (callback: (error: JobError) => void) => () => void
  onPlaywrightProgress: (callback: (progress: PlaywrightProgress) => void) => () => void
  onUpdateReady: (callback: () => void) => () => void
  restartAndUpdate: () => void

  // SimC export detection (addon → watcher → renderer)
  onSimcExport: (callback: (entry: SimcExportDetected) => void) => () => void
  dismissSimcExport: (charKey: string, timestamp: number) => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
