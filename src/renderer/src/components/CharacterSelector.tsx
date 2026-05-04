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

  const allSelected = characters.every((c) => selected.includes(c.id))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--sub)',
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.06em',
        marginRight: 2,
      }}>
        CHARACTERS{selected.length > 0 ? ` (${selected.length})` : ''}
      </span>

      {characters.map((char) => {
        const isSelected = selected.includes(char.id)
        return (
          <label
            key={char.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 5,
              cursor: 'pointer',
              background: isSelected ? 'rgba(124, 106, 247, 0.12)' : 'var(--surf2)',
              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.12s',
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggle(char.id)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 12, height: 12 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
              {char.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--sub)' }}>{char.spec}</span>
          </label>
        )
      })}

      {characters.length > 1 && (
        <button
          onClick={() => onChange(allSelected ? [] : characters.map((c) => c.id))}
          style={{
            padding: '3px 8px',
            borderRadius: 5,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid var(--border)',
            background: 'none',
            color: 'var(--sub)',
            transition: 'color 0.1s',
            marginLeft: 2,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--sub)' }}
        >
          {allSelected ? 'None' : 'All'}
        </button>
      )}
    </div>
  )
}
