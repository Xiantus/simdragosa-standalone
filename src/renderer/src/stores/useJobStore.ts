import { create } from 'zustand'
import type { Job, JobUpdate, JobDone, JobError, SimSelection } from '../../../shared/ipc'

export interface ActiveJob {
  job_id: string
  char_id: string
  char_name: string
  difficulty: string
  build_label: string
  status: Job['status']
  sim_id?: string
  url?: string
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
  handleJobUpdate: (update: JobUpdate) => void
  handleJobDone: (done: JobDone) => void
  handleJobError: (error: JobError) => void
  wireIpcEvents: () => () => void
}

const isActive = (s: string) =>
  ['queued', 'fetching', 'submitting', 'running'].includes(s)

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  running: false,

  startSim: async (selection) => {
    await window.api.startSim(selection)
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
          ? { ...j, status: 'done' as Job['status'], url: done.url, ended_at: Date.now() }
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
