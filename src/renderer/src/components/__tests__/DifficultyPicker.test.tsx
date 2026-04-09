import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DifficultyPicker from '../DifficultyPicker'

describe('DifficultyPicker', () => {
  it('renders all four difficulty options', () => {
    render(<DifficultyPicker selected={[]} onChange={vi.fn()} />)
    expect(screen.getByText('Normal')).toBeTruthy()
    expect(screen.getByText('Heroic')).toBeTruthy()
    expect(screen.getByText('Mythic')).toBeTruthy()
    expect(screen.getByText('M+ 10')).toBeTruthy()
  })

  it('highlights selected difficulties', () => {
    render(<DifficultyPicker selected={['raid-heroic']} onChange={vi.fn()} />)
    const heroic = screen.getByText('Heroic').closest('button')!
    expect(heroic.getAttribute('data-selected')).toBe('true')
  })

  it('calls onChange with toggled difficulty when clicked', () => {
    const onChange = vi.fn()
    render(<DifficultyPicker selected={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('Heroic'))
    expect(onChange).toHaveBeenCalledWith(['raid-heroic'])
  })

  it('removes difficulty when already selected and clicked again', () => {
    const onChange = vi.fn()
    render(<DifficultyPicker selected={['raid-heroic']} onChange={onChange} />)
    fireEvent.click(screen.getByText('Heroic'))
    expect(onChange).toHaveBeenCalledWith([])
  })
})
