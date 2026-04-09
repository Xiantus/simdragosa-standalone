import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Sidebar from '../Sidebar'

describe('Sidebar', () => {
  it('renders without crashing', () => {
    const { container } = render(<Sidebar />)
    expect(container.firstChild).not.toBeNull()
  })

  it('renders the character list area', () => {
    render(<Sidebar />)
    expect(screen.getByTestId('character-list')).toBeTruthy()
  })
})
