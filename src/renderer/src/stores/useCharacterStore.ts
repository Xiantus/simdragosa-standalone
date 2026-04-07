import { create } from 'zustand'
import type { Character } from '../../../shared/ipc'

interface CharacterState {
  characters: Character[]
  loading: boolean
  fetchCharacters: () => Promise<void>
  upsertCharacter: (char: Omit<Character, 'id'> & { id?: string }) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  loading: false,

  fetchCharacters: async () => {
    set({ loading: true })
    try {
      const characters = await window.api.getCharacters()
      set({ characters, loading: false })
    } catch (err) {
      console.error('fetchCharacters failed:', err)
      set({ loading: false })
    }
  },

  upsertCharacter: async (char) => {
    await window.api.upsertCharacter(char)
    await get().fetchCharacters()
  },

  deleteCharacter: async (id) => {
    await window.api.deleteCharacter(id)
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== id),
    }))
  },
}))
