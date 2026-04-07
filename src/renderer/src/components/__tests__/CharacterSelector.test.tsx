import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CharacterSelector from '../CharacterSelector'
import type { Character } from '../../../../shared/ipc'

const chars: Character[] = [
  { id: 'xiantus-fire', name: 'Xiantus', realm: 'illidan', region: 'us', spec: 'Fire', spec_id: 63, loot_spec_id: 63, simc_string: '', crafted_stats: '' },
  { id: 'xiantus-frost', name: 'Xiantus', realm: 'illidan', region: 'us', spec: 'Frost', spec_id: 64, loot_spec_id: 64, simc_string: '', crafted_stats: '' },
]

describe('CharacterSelector', () => {
  it('renders all characters as checkboxes', () => {
    render(<CharacterSelector characters={chars} selected={[]} onChange={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
  })

  it('checks boxes for selected characters', () => {
    render(<CharacterSelector characters={chars} selected={['xiantus-fire']} onChange={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true)
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false)
  })

  it('calls onChange with added id when unchecked box is clicked', () => {
    const onChange = vi.fn()
    render(<CharacterSelector characters={chars} selected={[]} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(onChange).toHaveBeenCalledWith(['xiantus-fire'])
  })

  it('calls onChange with removed id when checked box is clicked', () => {
    const onChange = vi.fn()
    render(<CharacterSelector characters={chars} selected={['xiantus-fire']} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('renders character name and spec', () => {
    render(<CharacterSelector characters={chars} selected={[]} onChange={vi.fn()} />)
    expect(screen.getAllByText('Xiantus').length).toBeGreaterThan(0)
    expect(screen.getByText('Fire')).toBeTruthy()
  })
})
