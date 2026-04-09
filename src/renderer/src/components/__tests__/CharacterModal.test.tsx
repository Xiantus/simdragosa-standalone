import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CharacterModal from '../CharacterModal'

describe('CharacterModal', () => {
  it('does not render when open=false', () => {
    const { container } = render(
      <CharacterModal open={false} onClose={vi.fn()} onSave={vi.fn()} />
    )
    expect(container.querySelector('[data-testid="character-modal"]')).toBeNull()
  })

  it('renders when open=true', () => {
    render(<CharacterModal open={true} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByTestId('character-modal')).toBeTruthy()
  })

  it('renders Name, Realm, Region, Spec fields', () => {
    render(<CharacterModal open={true} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByLabelText('Name')).toBeTruthy()
    expect(screen.getByLabelText('Realm')).toBeTruthy()
    expect(screen.getByLabelText('Region')).toBeTruthy()
    expect(screen.getByLabelText('Spec ID')).toBeTruthy()
  })

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn()
    render(<CharacterModal open={true} onClose={onClose} onSave={vi.fn()} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('pre-fills fields when editing an existing character', () => {
    const char = {
      id: 'xiantus-fire',
      name: 'Xiantus',
      realm: 'illidan',
      region: 'us',
      spec: 'Fire',
      spec_id: 63,
      loot_spec_id: 63,
      simc_string: 'mage="Xiantus"',
      crafted_stats: '36/49',
    }
    render(<CharacterModal open={true} character={char} onClose={vi.fn()} onSave={vi.fn()} />)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Xiantus')
    expect((screen.getByLabelText('Realm') as HTMLInputElement).value).toBe('illidan')
  })
})
