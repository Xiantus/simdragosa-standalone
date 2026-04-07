import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CharacterRow from '../CharacterRow'
import type { Character } from '../../../../shared/ipc'

const mockChar: Character = {
  id: 'xiantus-fire',
  name: 'Xiantus',
  realm: 'illidan',
  region: 'us',
  spec: 'Fire',
  spec_id: 63,
  loot_spec_id: 63,
  simc_string: 'mage="Xiantus"',
  crafted_stats: '36/49',
  ilvl: 639.5,
}

describe('CharacterRow', () => {
  it('renders the character name', () => {
    render(<CharacterRow character={mockChar} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Xiantus')).toBeTruthy()
  })

  it('renders the character spec', () => {
    render(<CharacterRow character={mockChar} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Fire')).toBeTruthy()
  })

  it('renders a delete button', () => {
    render(<CharacterRow character={mockChar} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByTitle('Delete')).toBeTruthy()
  })

  it('calls onDelete with character id when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(<CharacterRow character={mockChar} onEdit={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByTitle('Delete'))
    expect(onDelete).toHaveBeenCalledWith('xiantus-fire')
  })

  it('calls onEdit with character when row is clicked', () => {
    const onEdit = vi.fn()
    render(<CharacterRow character={mockChar} onEdit={onEdit} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByTestId('character-row'))
    expect(onEdit).toHaveBeenCalledWith(mockChar)
  })

  it('renders ilvl when present', () => {
    render(<CharacterRow character={mockChar} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/639/)).toBeTruthy()
  })
})
