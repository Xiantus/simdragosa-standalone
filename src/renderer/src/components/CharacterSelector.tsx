import React from 'react'
import type { Character } from '../../../shared/ipc'
import { iconUrlFromSpecId, iconUrlFromSpecName } from '../lib/specIcons'

interface Props {
  characters: Character[]
  selected: string[]
  onChange: (selected: string[]) => void
}

/**
 * Characters grouped by name: one chip per character, with a checkbox per
 * spec inside it.  Clicking the name toggles all of that character's specs.
 */
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

  const groups = new Map<string, Character[]>()
  for (const c of characters) {
    if (!groups.has(c.name)) groups.set(c.name, [])
    groups.get(c.name)!.push(c)
  }

  const toggleGroup = (chars: Character[]) => {
    const ids = chars.map((c) => c.id)
    const allOn = ids.every((id) => selected.includes(id))
    onChange(allOn
      ? selected.filter((id) => !ids.includes(id))
      : [...selected, ...ids.filter((id) => !selected.includes(id))])
  }

  const allSelected = characters.every((c) => selected.includes(c.id))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span className="section-label" style={{ marginRight: 2 }}>
        CHARACTERS{selected.length > 0 ? ` (${selected.length})` : ''}
      </span>
      {[...groups.entries()].map(([name, chars]) => {
        const onCount = chars.filter((c) => selected.includes(c.id)).length
        return (
          <div
            key={name}
            data-testid="char-group-chip"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '2px 4px 2px 2px',
              borderRadius: 6,
              background: onCount > 0 ? 'rgba(124, 106, 247, 0.12)' : 'var(--surf2)',
              border: `1px solid ${onCount > 0 ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.12s',
            }}
          >
            <button
              type="button"
              onClick={() => toggleGroup(chars)}
              title={chars.length > 1 ? `Toggle all ${chars.length} specs` : `Toggle ${name}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, color: 'var(--text)', padding: '1px 6px',
              }}
            >
              {name}
            </button>
            {chars.map((char) => {
              const isSelected = selected.includes(char.id)
              const icon = iconUrlFromSpecId(char.spec_id) || iconUrlFromSpecName(char.spec)
              return (
                <label
                  key={char.id}
                  title={`${name} — ${char.spec}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '1px 6px', borderRadius: 4, cursor: 'pointer',
                    background: isSelected ? 'rgba(124, 106, 247, 0.25)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(char.id)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 12, height: 12 }}
                  />
                  {icon && (
                    <img
                      src={icon} alt="" width={13} height={13}
                      style={{ borderRadius: 2 }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <span style={{ fontSize: 11, color: isSelected ? 'var(--text)' : 'var(--sub)' }}>{char.spec}</span>
                </label>
              )
            })}
          </div>
        )
      })}
      {characters.length > 1 && (
        <button
          type="button"
          className="pill"
          onClick={() => onChange(allSelected ? [] : characters.map((c) => c.id))}
          style={{ borderRadius: 5, padding: '3px 8px', background: 'none' }}
        >
          {allSelected ? 'None' : 'All'}
        </button>
      )}
    </div>
  )
}
