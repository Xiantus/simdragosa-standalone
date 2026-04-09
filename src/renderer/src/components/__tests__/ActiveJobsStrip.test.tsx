import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ActiveJobsStrip from '../ActiveJobsStrip'
import type { ActiveJob } from '../../stores/useJobStore'

const makeJob = (overrides: Partial<ActiveJob> = {}): ActiveJob => ({
  job_id: 'j1',
  char_id: 'xiantus-fire',
  char_name: 'Xiantus',
  difficulty: 'raid-heroic',
  build_label: 'Default',
  status: 'running',
  log_lines: [],
  started_at: Date.now(),
  ...overrides,
})

describe('ActiveJobsStrip', () => {
  it('does not render when running=false', () => {
    const { container } = render(<ActiveJobsStrip running={false} jobs={[]} />)
    expect(container.querySelector('[data-testid="active-jobs-strip"]')).toBeNull()
  })

  it('renders when running=true with at least one active job', () => {
    render(<ActiveJobsStrip running={true} jobs={[makeJob()]} />)
    expect(screen.getByTestId('active-jobs-strip')).toBeTruthy()
  })

  it('shows character name of active job', () => {
    render(<ActiveJobsStrip running={true} jobs={[makeJob({ char_name: 'Xiantus' })]} />)
    expect(screen.getByTestId('active-jobs-strip').textContent).toContain('Xiantus')
  })

  it('shows count of active jobs', () => {
    const jobs = [
      makeJob({ job_id: 'j1', char_name: 'Alpha', status: 'running' }),
      makeJob({ job_id: 'j2', char_name: 'Beta', status: 'fetching' }),
    ]
    render(<ActiveJobsStrip running={true} jobs={jobs} />)
    expect(screen.getByTestId('active-jobs-strip').textContent).toMatch(/2/)
  })

  it('does not count finished jobs in the strip', () => {
    const jobs = [
      makeJob({ job_id: 'j1', char_name: 'Alpha', status: 'running' }),
      makeJob({ job_id: 'j2', char_name: 'Beta', status: 'done' }),
    ]
    render(<ActiveJobsStrip running={true} jobs={jobs} />)
    // Only 1 active job
    expect(screen.getByTestId('active-jobs-strip').textContent).toMatch(/1/)
  })
})
