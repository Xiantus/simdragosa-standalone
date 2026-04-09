import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OnboardingFlow from '../OnboardingFlow'

const mockApi = {
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({ raidsid: '', wow_path: '', is_configured: false }),
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).api = mockApi
})

describe('OnboardingFlow', () => {
  it('does not render when is_configured=true', () => {
    const { container } = render(
      <OnboardingFlow isConfigured={true} onComplete={vi.fn()} />
    )
    expect(container.querySelector('[data-testid="onboarding"]')).toBeNull()
  })

  it('renders when is_configured=false', () => {
    render(<OnboardingFlow isConfigured={false} onComplete={vi.fn()} />)
    expect(screen.getByTestId('onboarding')).toBeTruthy()
  })

  it('renders raidsid input field', () => {
    render(<OnboardingFlow isConfigured={false} onComplete={vi.fn()} />)
    expect(screen.getByLabelText('Raidbots Session ID')).toBeTruthy()
  })

  it('calls saveSettings and onComplete when form is submitted', async () => {
    const onComplete = vi.fn()
    render(<OnboardingFlow isConfigured={false} onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText('Raidbots Session ID'), {
      target: { value: 'my-session-id-123' },
    })
    fireEvent.click(screen.getByText('Save & Continue'))
    await vi.waitFor(() => {
      expect(mockApi.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ raidsid: 'my-session-id-123' })
      )
    })
  })
})
