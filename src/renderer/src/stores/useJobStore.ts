import { create } from 'zustand'
import type { Job, JobUpdate, JobDone, JobError, SimSelection, DpsGain, JobQueued } from '../../../shared/ipc'

export interface ActiveJob {
  job_id: string
  char_id: string
  char_name: string
  spec?: string
  difficulty: string
  build_label: string
  status: Job['status']
  sim_id?: string
  url?: string
  dps_gains?: DpsGain[]
  error_message?: string
  log_lines: string[]
  started_at: number
  ended_at?: number
}

interface JobState {
  jobs: ActiveJob[]
  running: boolean
  startSim: (selection: SimSelection) => Promise<void>
  cancelJobs: () => Promise<void>
  deleteJob: (job_id: string, char_id: string, difficulty: string, build_label: string, char_name: string, spec: string) => Promise<void>
  handleJobUpdate: (update: JobUpdate) => void
  handleJobDone: (done: JobDone) => void
  handleJobError: (error: JobError) => void
  loadHistoricalJobs: () => Promise<void>
  wireIpcEvents: () => () => void
}

const isActive = (s: string) =>
  ['queued', 'fetching', 'submitting', 'running'].includes(s)

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  running: false,

  startSim: async (selection) => {
    const queued: JobQueued[] = await window.api.startSim(selection)
    if (queued && queued.length > 0) {
      set((state) => ({
        jobs: [
          ...state.jobs,
          ...queued.map((q) => ({
            job_id: q.job_id,
            char_id: q.char_id,
            char_name: q.char_name,
            spec: q.spec,
            difficulty: q.difficulty,
            build_label: q.build_label,
            status: 'queued' as Job['status'],
            log_lines: [],
            started_at: Date.now(),
          })),
        ],
        running: true,
      }))
    }
  },

  deleteJob: async (job_id, char_id, difficulty, build_label, char_name, spec) => {
    await window.api.deleteResult(char_id, difficulty, build_label, char_name, spec)
    set((state) => ({ jobs: state.jobs.filter((j) => j.job_id !== job_id) }))
  },

  cancelJobs: async () => {
    await window.api.cancelJobs()
    set((state) => ({
      jobs: state.jobs.map((j) =>
        isActive(j.status)
          ? { ...j, status: 'cancelled' as Job['status'], ended_at: Date.now() }
          : j
      ),
      running: false,
    }))
  },

  handleJobUpdate: (update) => {
    set((state) => {
      const exists = state.jobs.find((j) => j.job_id === update.job_id)
      const jobs = exists
        ? state.jobs.map((j) =>
            j.job_id === update.job_id
              ? {
                  ...j,
                  status: update.status,
                  sim_id: update.sim_id ?? j.sim_id,
                  log_lines: update.log_line
                    ? [...j.log_lines, update.log_line]
                    : j.log_lines,
                }
              : j
          )
        : [
            ...state.jobs,
            {
              job_id: update.job_id,
              char_id: '',
              char_name: update.job_id,
              difficulty: '',
              build_label: '',
              status: update.status,
              sim_id: update.sim_id,
              log_lines: update.log_line ? [update.log_line] : [],
              started_at: Date.now(),
            },
          ]
      return { jobs, running: jobs.some((j) => isActive(j.status)) }
    })
  },

  handleJobDone: (done) => {
    set((state) => {
      const jobs = state.jobs.map((j) =>
        j.job_id === done.job_id
          ? { ...j, status: 'done' as Job['status'], url: done.url, dps_gains: done.dps_gains, ended_at: Date.now() }
          : j
      )
      return { jobs, running: jobs.some((j) => isActive(j.status)) }
    })
  },

  handleJobError: (error) => {
    set((state) => {
      const jobs = state.jobs.map((j) =>
        j.job_id === error.job_id
          ? {
              ...j,
              status: 'error' as Job['status'],
              error_message: error.message,
              ended_at: Date.now(),
            }
          : j
      )
      return { jobs, running: jobs.some((j) => isActive(j.status)) }
    })
  },

  loadHistoricalJobs: async () => {
    const stored = await window.api.getJobResults()
    if (!stored || stored.length === 0) return
    set((state) => {
      // Skip records that have no proper char_name (old format without metadata)
      const valid = stored.filter((r) => r && r.job_id && r.char_name && r.char_id)

      // Don't add historical records that duplicate a live-session job
      // Match on char_id + difficulty + build_label (same logical sim, different run)
      const existingIds = new Set(state.jobs.map((j) => j.job_id))
      const existingKeys = new Set(
        state.jobs.map((j) => `${j.char_id}|${j.difficulty}|${j.build_label}`)
      )

      const historical: ActiveJob[] = valid
        .filter((r) => !existingIds.has(r.job_id) && !existingKeys.has(`${r.char_id}|${r.difficulty}|${r.build_label}`))
        .map((r) => ({
          job_id: r.job_id,
          char_id: r.char_id,
          char_name: r.char_name,
          spec: r.spec,
          difficulty: r.difficulty,
          build_label: r.build_label ?? 'Default',
          status: r.status as Job['status'],
          url: r.url,
          dps_gains: r.dps_gains,
          error_message: r.error_message,
          log_lines: [],
          started_at: r.ended_at ?? 0,
          ended_at: r.ended_at,
        }))

      historical.sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0))
      return { jobs: [...state.jobs, ...historical] }
    })
  },

  wireIpcEvents: () => {
    const unsubUpdate = window.api.onJobUpdate((u) => get().handleJobUpdate(u))
    const unsubDone = window.api.onJobDone((d) => get().handleJobDone(d))
    const unsubError = window.api.onJobError((e) => get().handleJobError(e))
    return () => {
      unsubUpdate()
      unsubDone()
      unsubError()
    }
  },
}))
