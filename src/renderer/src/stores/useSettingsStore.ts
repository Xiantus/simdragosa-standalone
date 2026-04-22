import { create } from 'zustand'
import type { Settings } from '../../../shared/ipc'

interface SettingsState extends Settings {
  fetchSettings: () => Promise<void>
  saveSettings: (partial: Partial<Settings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  raidsid: '',
  wow_path: '',
  is_configured: false,
  version: '',
  minimizeToTray: false,

  fetchSettings: async () => {
    try {
      const settings = await window.api.getSettings()
      set(settings)
    } catch (err) {
      console.error('fetchSettings failed:', err)
    }
  },

  saveSettings: async (partial) => {
    await window.api.saveSettings(partial)
    set((s) => ({ ...s, ...partial, is_configured: Boolean(partial.raidsid ?? s.raidsid) }))
  },
}))
