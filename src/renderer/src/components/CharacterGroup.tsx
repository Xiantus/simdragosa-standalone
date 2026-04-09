import React, { useState } from 'react'
import type { Character } from '../../../shared/ipc'
import CharacterRow from './CharacterRow'

interface Props {
  spec: string
  characters: Character[]
  onEdit: (char: Character) => void
  onDelete: (id: string) => void
}

export default function CharacterGroup({ spec, characters, onEdit, onDelete }: Props): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          color: 'var(--sub)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        <span style={{ fontSize: 9, display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
        {spec}
        <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{characters.length}</span>
      </button>
      {!collapsed && (
        <div>
          {characters.map((char) => (
            <CharacterRow key={char.id} character={char} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
