import React, { useEffect, useState } from 'react'
import { useCharacterStore } from '../stores/useCharacterStore'
import CharacterGroup from './CharacterGroup'
import CharacterModal from './CharacterModal'
import type { Character } from '../../../shared/ipc'

export default function Sidebar(): JSX.Element {
  const { characters, fetchCharacters, upsertCharacter, deleteCharacter } = useCharacterStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Character | undefined>(undefined)

  useEffect(() => {
    fetchCharacters()
  }, [])

  // Group by character name
  const byName = characters.reduce<Record<string, Character[]>>((acc, c) => {
    if (!acc[c.name]) acc[c.name] = []
    acc[c.name].push(c)
    return acc
  }, {})

  const handleEdit = (char: Character) => {
    setEditing(char)
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditing(undefined)
    setModalOpen(true)
  }

  const handleSave = async (char: Omit<Character, 'id'> & { id?: string }) => {
    await upsertCharacter(char)
    setModalOpen(false)
  }

  return (
    <>
      <aside
        style={{
          width: 280, minWidth: 220, maxWidth: 320,
          background: 'var(--surf)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        }}
      >
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Characters
          </span>
          <button onClick={handleAdd} style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}>
            + Add
          </button>
        </div>

        <div data-testid="character-list" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {characters.length === 0 ? (
            <div style={{ color: 'var(--sub)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
              No characters yet
            </div>
          ) : (
            Object.entries(byName).sort(([a], [b]) => a.localeCompare(b)).map(([name, chars]) => (
              <CharacterGroup
                key={name}
                name={name}
                characters={chars}
                onEdit={handleEdit}
                onDelete={deleteCharacter}
              />
            ))
          )}
        </div>
      </aside>

      <CharacterModal
        open={modalOpen}
        character={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </>
  )
}
