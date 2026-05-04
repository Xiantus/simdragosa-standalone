import React from 'react'

const DIFFICULTIES = [
  { key: 'raid-normal',          label: 'Normal' },
  { key: 'raid-heroic',          label: 'Heroic' },
  { key: 'raid-mythic',          label: 'Mythic' },
  { key: 'dungeon-mythic10',     label: 'M+ 10' },
  { key: 'dungeon-mythic-weekly10', label: 'M+ 10 Vault' },
]

const ALL_KEYS = DIFFICULTIES.map((d) => d.key)

interface Props {
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function DifficultyPicker({ selected, onChange }: Props): JSX.Element {
  const toggle = (key: string) => {
    if (selected.includes(key)) onChange(selected.filter((k) => k !== key))
    else onChange([...selected, key])
  }

  const allSelected = ALL_KEYS.every((k) => selected.includes(k))

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
        DIFFICULTY{selected.length > 0 ? ` (${selected.length})` : ''}
      </span>

      {DIFFICULTIES.map(({ key, label }) => {
        const isSelected = selected.includes(key)
        return (
          <button
            key={key}
            data-selected={isSelected ? 'true' : 'false'}
            onClick={() => toggle(key)}
            style={{
              padding: '3px 11px',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              background: isSelected ? 'var(--accent)' : 'var(--surf2)',
              color: isSelected ? '#fff' : 'var(--sub)',
              borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.12s',
            }}
          >
            {label}
          </button>
        )
      })}

      {/* All / None shortcuts */}
      <button
        onClick={() => onChange(allSelected ? [] : [...ALL_KEYS])}
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
    </div>
  )
}
