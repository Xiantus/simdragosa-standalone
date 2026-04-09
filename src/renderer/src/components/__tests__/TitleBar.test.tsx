import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TitleBar from '../TitleBar'

const mockApi = {
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  getOverlayMode: vi.fn().mockResolvedValue(false),
  setOverlayMode: vi.fn().mockResolvedValue(undefined),
  onOverlayChanged: vi.fn(() => vi.fn()),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.getOverlayMode = vi.fn().mockResolvedValue(false)
  mockApi.setOverlayMode = vi.fn().mockResolvedValue(undefined)
  mockApi.onOverlayChanged = vi.fn(() => vi.fn())
  ;(window as any).api = mockApi
})

describe('TitleBar', () => {
  it('renders the app title', async () => {
    await act(async () => { render(<TitleBar />) })
    expect(screen.getByText('Simdragosa')).toBeTruthy()
  })

  it('calls minimizeWindow when minimize button is clicked', async () => {
    await act(async () => { render(<TitleBar />) })
    fireEvent.click(screen.getByTitle('Minimize'))
    expect(mockApi.minimizeWindow).toHaveBeenCalledTimes(1)
  })

  it('calls maximizeWindow when maximize button is clicked', async () => {
    await act(async () => { render(<TitleBar />) })
    fireEvent.click(screen.getByTitle('Maximize'))
    expect(mockApi.maximizeWindow).toHaveBeenCalledTimes(1)
  })

  it('calls closeWindow when close button is clicked', async () => {
    await act(async () => { render(<TitleBar />) })
    fireEvent.click(screen.getByTitle('Close'))
    expect(mockApi.closeWindow).toHaveBeenCalledTimes(1)
  })

  it('has a drag region element', async () => {
    let container: HTMLElement
    await act(async () => { ({ container } = render(<TitleBar />)) })
    const dragRegion = container!.querySelector('[data-drag-region]')
    expect(dragRegion).not.toBeNull()
  })

  // Overlay mode tests
  it('renders "In-Game" button when overlayMode is false', async () => {
    mockApi.getOverlayMode = vi.fn().mockResolvedValue(false)
    await act(async () => { render(<TitleBar />) })
    expect(screen.getByText(/In-Game/)).toBeTruthy()
  })

  it('renders "Desktop" button when overlayMode is true', async () => {
    mockApi.getOverlayMode = vi.fn().mockResolvedValue(true)
    ;(window as any).api = mockApi
    await act(async () => { render(<TitleBar />) })
    expect(screen.getByText(/Desktop/)).toBeTruthy()
  })

  it('calls setOverlayMode(true) when "In-Game" button is clicked', async () => {
    mockApi.getOverlayMode = vi.fn().mockResolvedValue(false)
    await act(async () => { render(<TitleBar />) })
    const btn = screen.getByText(/In-Game/)
    await act(async () => { fireEvent.click(btn) })
    expect(mockApi.setOverlayMode).toHaveBeenCalledWith(true)
  })

  it('calls setOverlayMode(false) when "Desktop" button is clicked', async () => {
    mockApi.getOverlayMode = vi.fn().mockResolvedValue(true)
    ;(window as any).api = mockApi
    await act(async () => { render(<TitleBar />) })
    const btn = screen.getByText(/Desktop/)
    await act(async () => { fireEvent.click(btn) })
    expect(mockApi.setOverlayMode).toHaveBeenCalledWith(false)
  })
})
