import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResultsPanel from '../ResultsPanel'
import PresetBar from '../PresetBar'
import type { ActiveJob } from '../../stores/useJobStore'

const DAY = 86400_000

function job(over: Partial<ActiveJob>): ActiveJob {
  return {
    job_id: Math.random().toString(36).slice(2),
    char_id: 'xian-fire', char_name: 'Xian', spec: 'fire',
    difficulty: 'raid-heroic', build_label: 'Default', status: 'done',
    log_lines: [], started_at: Date.now() - 60_000, ended_at: Date.now() - 30_000,
    url: 'https://www.raidbots.com/simbot/report/abc',
    dps_gains: [
      { item_id: 1, dps_gain: 1200, ilvl: 321, item_name: 'Blade of Testing', zone_name: 'Boss A', pct: 1.2 },
      { item_id: 2, dps_gain: 400, ilvl: 321, item_name: 'Ring of Mocks', zone_name: 'Boss B' },
    ],
    ...over,
  }
}

beforeEach(() => {
  localStorage.clear()
  ;(window as any).api.fetchItemNames = vi.fn().mockResolvedValue({})
  ;(window as any).api.getSimHistory = vi.fn().mockResolvedValue([])
  ;(window as any).api.deleteResult = vi.fn().mockResolvedValue(undefined)
})

describe('ResultsPanel', () => {
  it('shows age on each card and dims results older than a week', () => {
    render(<ResultsPanel jobs={[
      job({ difficulty: 'raid-heroic' }),
      job({ difficulty: 'raid-mythic', ended_at: Date.now() - 9 * DAY }),
    ]} />)
    const cards = screen.getAllByTestId('diff-card')
    expect(cards[0].getAttribute('data-stale')).toBeNull()
    expect(cards[1].getAttribute('data-stale')).toBe('true')
    expect(screen.getByText(/9d ago · stale/)).toBeTruthy()
  })

  it('flags results simmed before the gear last changed', () => {
    render(<ResultsPanel
      jobs={[job({ ended_at: Date.now() - DAY })]}
      characters={[{ id: 'xian-fire', name: 'Xian', realm: 'r', region: 'eu', spec: 'fire', spec_id: 63, loot_spec_id: 63, simc_string: '', crafted_stats: '', simc_updated_at: Date.now() - 1000 }]}
    />)
    expect(screen.getByText(/gear changed since/)).toBeTruthy()
  })

  it('expands a card into bars with source and percent', () => {
    render(<ResultsPanel jobs={[job({})]} />)
    fireEvent.click(screen.getByTestId('diff-card'))
    expect(screen.getAllByText('Blade of Testing').length).toBeGreaterThan(0)
    expect(screen.getByText('Boss A')).toBeTruthy()
    expect(screen.getByText('+1.20%')).toBeTruthy()
  })

  it('re-runs a single card with its character and difficulty', () => {
    const onRerun = vi.fn()
    render(<ResultsPanel jobs={[job({ difficulty: 'raid-mythic' })]} onRerun={onRerun} />)
    fireEvent.mouseEnter(screen.getByTestId('diff-card'))
    fireEvent.click(screen.getByLabelText('Re-run Mythic'))
    expect(onRerun).toHaveBeenCalledWith(['xian-fire'], ['raid-mythic'])
  })

  it('hides re-run while sims are running', () => {
    render(<ResultsPanel jobs={[job({})]} onRerun={vi.fn()} running />)
    fireEvent.mouseEnter(screen.getByTestId('diff-card'))
    expect(screen.queryByLabelText('Re-run Heroic')).toBeNull()
  })

  it('switches to the best-items and where-to-farm views', () => {
    render(<ResultsPanel jobs={[
      job({ difficulty: 'raid-heroic' }),
      job({ difficulty: 'raid-mythic', dps_gains: [{ item_id: 1, dps_gain: 2000, ilvl: 334, zone_name: 'Boss A' }] }),
    ]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Best items' }))
    expect(screen.getByTestId('best-items')).toBeTruthy()
    expect(screen.getByText('+2,000 dps')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Where to farm' }))
    expect(screen.getByTestId('farm-view')).toBeTruthy()
    expect(screen.getByText('+2,000 total')).toBeTruthy()
  })

  it('remembers the chosen view', () => {
    const { unmount } = render(<ResultsPanel jobs={[job({})]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Best items' }))
    unmount()
    render(<ResultsPanel jobs={[job({})]} />)
    expect(screen.getByRole('tab', { name: 'Best items' }).getAttribute('aria-selected')).toBe('true')
  })

  it('keeps showing results whose re-run failed, with a warning', () => {
    render(<ResultsPanel jobs={[job({ rerun_error: 'armory_fetch_failed' })]} />)
    expect(screen.getByText('2 upgrades')).toBeTruthy()
    expect(screen.getByTitle('armory_fetch_failed')).toBeTruthy()
  })

  it('asks before deleting a result', () => {
    render(<ResultsPanel jobs={[job({})]} />)
    fireEvent.mouseEnter(screen.getByTestId('diff-card'))
    fireEvent.click(screen.getByTitle('Delete this sim'))
    expect((window as any).api.deleteResult).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Delete?'))
    expect((window as any).api.deleteResult).toHaveBeenCalled()
  })
})

describe('PresetBar', () => {
  it('saves the current selection under a typed name', () => {
    const onSave = vi.fn()
    render(<PresetBar presets={[]} activeName={null} canSave onApply={vi.fn()} onSave={onSave} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('+ Save current'))
    const input = screen.getByLabelText('Preset name')
    fireEvent.change(input, { target: { value: 'Main H+M' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('Main H+M')
  })

  it('applies a preset and marks the active one', () => {
    const onApply = vi.fn()
    const p = { name: 'Alts', chars: ['a'], diffs: ['raid-heroic'] }
    render(<PresetBar presets={[p]} activeName="Alts" canSave onApply={onApply} onSave={vi.fn()} onDelete={vi.fn()} />)
    const btn = screen.getByText('Alts')
    expect(btn.getAttribute('data-active')).toBe('true')
    fireEvent.click(btn)
    expect(onApply).toHaveBeenCalledWith(p)
  })
})
