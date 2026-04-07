import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RunButton from '../RunButton'

describe('RunButton', () => {
  it('is disabled when no characters are selected', () => {
    render(<RunButton disabled={true} running={false} onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is enabled when characters and difficulties are selected', () => {
    render(<RunButton disabled={false} running={false} onClick={vi.fn()} />)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('calls onClick when clicked and not disabled', () => {
    const onClick = vi.fn()
    render(<RunButton disabled={false} running={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows GO when not running', () => {
    render(<RunButton disabled={false} running={false} onClick={vi.fn()} />)
    expect(screen.getByText('GO')).toBeTruthy()
  })

  it('shows Cancel when running', () => {
    render(<RunButton disabled={false} running={true} onClick={vi.fn()} />)
    expect(screen.getByText('Cancel')).toBeTruthy()
  })
})
