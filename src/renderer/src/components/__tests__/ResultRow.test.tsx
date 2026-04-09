import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ResultRow from '../ResultRow'
import type { ActiveJob } from '../../stores/useJobStore'

const baseJob: ActiveJob = {
  job_id: 'j1',
  char_id: 'xiantus-fire',
  char_name: 'Xiantus',
  difficulty: 'raid-heroic',
  build_label: 'Default',
  status: 'done',
  url: 'https://www.raidbots.com/simbot/report/abc123',
  log_lines: [],
  started_at: Date.now() - 60000,
  ended_at: Date.now(),
}

describe('ResultRow', () => {
  it('renders character name', () => {
    render(<ResultRow job={baseJob} />)
    expect(screen.getByText('Xiantus')).toBeTruthy()
  })

  it('renders difficulty label (Heroic for raid-heroic)', () => {
    render(<ResultRow job={baseJob} />)
    expect(screen.getByText('Heroic')).toBeTruthy()
  })

  it('shows a link when status is done', () => {
    render(<ResultRow job={baseJob} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://www.raidbots.com/simbot/report/abc123')
  })

  it('shows error message when status is error', () => {
    const errJob: ActiveJob = {
      ...baseJob,
      status: 'error',
      url: undefined,
      error_message: 'Network timeout after 30m',
    }
    render(<ResultRow job={errJob} />)
    expect(screen.getByText(/Network timeout after 30m/)).toBeTruthy()
  })

  it('shows DONE status badge', () => {
    render(<ResultRow job={baseJob} />)
    expect(screen.getByText('DONE')).toBeTruthy()
  })

  it('shows ERROR status badge for errored job', () => {
    const errJob: ActiveJob = { ...baseJob, status: 'error', error_message: 'oops' }
    render(<ResultRow job={errJob} />)
    expect(screen.getByText('ERROR')).toBeTruthy()
  })
})
