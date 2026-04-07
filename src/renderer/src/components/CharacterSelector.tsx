import React from 'react'
import type { Character } from '../../../shared/ipc'

interface Props {
  characters: Character[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function CharacterSelector({ characters, selected, onChange }: Props): JSX.Element {
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id))
    else onChange([...selected, id])
  }

  if (characters.length === 0) {
    return (
      <div style={{ color: 'var(--sub)', fontSize: 12 }}>
        Add characters in the sidebar to start simming
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {characters.map((char) => {
        const isSelected = selected.includes(char.id)
        return (
          <label
            key={char.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
              background: isSelected ? 'var(--surf2)' : 'transparent',
              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.1s',
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggle(char.id)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
              {char.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--sub)' }}>{char.spec}</span>
          </label>
        )
      })}
    </div>
  )
}
