import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsPanel from '../SettingsPanel'

const mockApi = {
  saveSettings: vi.fn().mockResolvedValue(undefined),
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).api = mockApi
})

describe('SettingsPanel', () => {
  it('does not render when open=false', () => {
    const { container } = render(
      <SettingsPanel open={false} onClose={vi.fn()} />
    )
    expect(container.querySelector('[data-testid="settings-panel"]')).toBeNull()
  })

  it('renders when open=true', () => {
    render(<SettingsPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('settings-panel')).toBeTruthy()
  })

  it('pre-fills raidsid from prop', () => {
    render(<SettingsPanel open={true} raidsid="existing-sid" wow_path="" onClose={vi.fn()} />)
    expect((screen.getByLabelText('Raidbots Session ID') as HTMLInputElement).value).toBe('existing-sid')
  })

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn()
    render(<SettingsPanel open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls saveSettings on submit', async () => {
    const onClose = vi.fn()
    render(<SettingsPanel open={true} raidsid="" wow_path="" onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Raidbots Session ID'), {
      target: { value: 'new-sid' },
    })
    fireEvent.click(screen.getByText('Save'))
    await vi.waitFor(() => {
      expect(mockApi.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ raidsid: 'new-sid' })
      )
    })
  })
})
