import React from 'react'

const DIFFICULTIES = [
  { key: 'raid-normal', label: 'Normal' },
  { key: 'raid-heroic', label: 'Heroic' },
  { key: 'raid-mythic', label: 'Mythic' },
  { key: 'dungeon-mythic10', label: 'M+ 10' },
  { key: 'dungeon-mythic-weekly10', label: 'M+ 10 Vault' },
]

interface Props {
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function DifficultyPicker({ selected, onChange }: Props): JSX.Element {
  const toggle = (key: string) => {
    if (selected.includes(key)) onChange(selected.filter((k) => k !== key))
    else onChange([...selected, key])
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {DIFFICULTIES.map(({ key, label }) => {
        const isSelected = selected.includes(key)
        return (
          <button
            key={key}
            data-selected={isSelected ? 'true' : 'false'}
            onClick={() => toggle(key)}
            style={{
              padding: '4px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: '1px solid',
              background: isSelected ? 'var(--accent)' : 'var(--surf2)',
              color: isSelected ? '#fff' : 'var(--sub)',
              borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.1s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
