import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MainPanel from '../MainPanel'

describe('MainPanel', () => {
  it('renders without crashing', () => {
    const { container } = render(<MainPanel />)
    expect(container.firstChild).not.toBeNull()
  })

  it('renders RunPanel area', () => {
    render(<MainPanel />)
    expect(screen.getByTestId('run-panel')).toBeTruthy()
  })

  it('renders ResultsPanel area', () => {
    render(<MainPanel />)
    expect(screen.getByTestId('results-panel')).toBeTruthy()
  })
})
