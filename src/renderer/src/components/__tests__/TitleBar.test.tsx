import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TitleBar from '../TitleBar'

const mockApi = {
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).api = mockApi
})

describe('TitleBar', () => {
  it('renders the app title', () => {
    render(<TitleBar />)
    expect(screen.getByText('Simdragosa')).toBeTruthy()
  })

  it('calls minimizeWindow when minimize button is clicked', () => {
    render(<TitleBar />)
    fireEvent.click(screen.getByTitle('Minimize'))
    expect(mockApi.minimizeWindow).toHaveBeenCalledTimes(1)
  })

  it('calls maximizeWindow when maximize button is clicked', () => {
    render(<TitleBar />)
    fireEvent.click(screen.getByTitle('Maximize'))
    expect(mockApi.maximizeWindow).toHaveBeenCalledTimes(1)
  })

  it('calls closeWindow when close button is clicked', () => {
    render(<TitleBar />)
    fireEvent.click(screen.getByTitle('Close'))
    expect(mockApi.closeWindow).toHaveBeenCalledTimes(1)
  })

  it('has a drag region element', () => {
    const { container } = render(<TitleBar />)
    const dragRegion = container.querySelector('[data-drag-region]')
    expect(dragRegion).not.toBeNull()
  })
})
