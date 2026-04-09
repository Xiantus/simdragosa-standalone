import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PlaywrightInstallModal from '../PlaywrightInstallModal'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlaywrightInstallModal', () => {
  it('does not render when open=false', () => {
    const { container } = render(
      <PlaywrightInstallModal open={false} onClose={vi.fn()} />
    )
    expect(container.querySelector('[data-testid="playwright-install-modal"]')).toBeNull()
  })

  it('renders when open=true', () => {
    render(<PlaywrightInstallModal open={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('playwright-install-modal')).toBeTruthy()
  })

  it('shows install and cancel buttons initially', () => {
    render(<PlaywrightInstallModal open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /install/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy()
  })

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn()
    render(<PlaywrightInstallModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls installPlaywright when install button clicked', async () => {
    render(<PlaywrightInstallModal open={true} onClose={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }))
    })
    expect(window.api.installPlaywright).toHaveBeenCalledOnce()
  })

  it('shows progress bar after install is clicked', async () => {
    render(<PlaywrightInstallModal open={true} onClose={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }))
    })
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('disables install button while installing', async () => {
    render(<PlaywrightInstallModal open={true} onClose={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }))
    })
    expect(screen.getByRole('button', { name: /installing/i })).toBeTruthy()
    expect((screen.getByRole('button', { name: /installing/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows progress message from onPlaywrightProgress', async () => {
    // Capture the callback registered via onPlaywrightProgress
    let capturedCallback: ((p: { percent: number; message: string }) => void) | null = null
    ;(window.api.onPlaywrightProgress as ReturnType<typeof vi.fn>).mockImplementation((cb) => {
      capturedCallback = cb
      return vi.fn()
    })

    render(<PlaywrightInstallModal open={true} onClose={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }))
    })

    act(() => {
      capturedCallback!({ percent: 42, message: 'Downloading chromium...' })
    })

    expect(screen.getByText(/Downloading chromium/)).toBeTruthy()
  })

  it('shows done state and close button when percent reaches 100', async () => {
    let capturedCallback: ((p: { percent: number; message: string }) => void) | null = null
    ;(window.api.onPlaywrightProgress as ReturnType<typeof vi.fn>).mockImplementation((cb) => {
      capturedCallback = cb
      return vi.fn()
    })

    render(<PlaywrightInstallModal open={true} onClose={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }))
    })

    act(() => {
      capturedCallback!({ percent: 100, message: 'Done' })
    })

    expect(screen.getByRole('button', { name: /close/i })).toBeTruthy()
  })

  it('calls onClose when close button clicked after done', async () => {
    let capturedCallback: ((p: { percent: number; message: string }) => void) | null = null
    ;(window.api.onPlaywrightProgress as ReturnType<typeof vi.fn>).mockImplementation((cb) => {
      capturedCallback = cb
      return vi.fn()
    })

    const onClose = vi.fn()
    render(<PlaywrightInstallModal open={true} onClose={onClose} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }))
    })

    act(() => {
      capturedCallback!({ percent: 100, message: 'Done' })
    })

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('unsubscribes from onPlaywrightProgress on unmount', async () => {
    const unsub = vi.fn()
    ;(window.api.onPlaywrightProgress as ReturnType<typeof vi.fn>).mockReturnValue(unsub)

    const { unmount } = render(<PlaywrightInstallModal open={true} onClose={vi.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }))
    })

    unmount()
    expect(unsub).toHaveBeenCalled()
  })
})
