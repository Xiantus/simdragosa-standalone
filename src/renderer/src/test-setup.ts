import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Global window.api mock — individual tests can override specific methods
const noop = vi.fn().mockResolvedValue(undefined)
const noopSync = vi.fn()
const unsubscribe = vi.fn(() => vi.fn())

;(window as any).api = {
  // Characters
  getCharacters: vi.fn().mockResolvedValue([]),
  upsertCharacter: noop,
  deleteCharacter: noop,

  // Settings
  getSettings: vi.fn().mockResolvedValue({ raidsid: '', wow_path: '', is_configured: false }),
  saveSettings: noop,

  // Sim
  startSim: noop,
  cancelJobs: noop,
  exportLua: vi.fn().mockResolvedValue(''),

  // Playwright
  isPlaywrightInstalled: vi.fn().mockResolvedValue(false),
  installPlaywright: noop,

  // Window controls
  minimizeWindow: noopSync,
  maximizeWindow: noopSync,
  closeWindow: noopSync,

  // Push events
  onJobUpdate: unsubscribe,
  onJobDone: unsubscribe,
  onJobError: unsubscribe,
  onPlaywrightProgress: unsubscribe,
}
