import React from 'react'
import type { Character } from '../../../shared/ipc'
import { iconUrlFromSpecId } from '../lib/specIcons'

interface Props {
  character: Character
  onEdit: (char: Character) => void
  onDelete: (id: string) => void
}

export default function CharacterRow({ character, onEdit, onDelete }: Props): JSX.Element {
  return (
    <div
      data-testid="character-row"
      onClick={() => onEdit(character)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '7px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        gap: 8,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--surf2)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {character.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          {iconUrlFromSpecId(character.spec_id) && (
            <img
              src={iconUrlFromSpecId(character.spec_id)!}
              alt=""
              width={14}
              height={14}
              style={{ borderRadius: 2, flexShrink: 0 }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <span>{character.spec}</span>
          {character.ilvl ? <span>{` · ${Math.round(character.ilvl * 10) / 10}`}</span> : null}
        </div>
      </div>
      <button
        title="Delete"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(character.id)
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--sub)',
          cursor: 'pointer',
          fontSize: 14,
          padding: '2px 4px',
          borderRadius: 4,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--red)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--sub)'
        }}
      >
        ✕
      </button>
    </div>
  )
}
