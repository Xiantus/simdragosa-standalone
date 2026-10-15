import React, { useState } from 'react'
import type { Preset } from '../lib/selection'
import ConfirmButton from './ConfirmButton'

interface Props {
  presets: Preset[]
  /** The preset matching the current selection exactly, if any. */
  activeName: string | null
  canSave: boolean
  onApply: (preset: Preset) => void
  onSave: (name: string) => void
  onDelete: (name: string) => void
}

/** Saved selections ("Main — H+M", "All alts — Heroic"): apply, save current, delete. */
export default function PresetBar({ presets, activeName, canSave, onApply, onSave, onDelete }: Props): JSX.Element {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const commit = () => {
    if (name.trim()) onSave(name)
    setName('')
    setNaming(false)
  }

  return (
    <div data-testid="preset-bar" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span className="section-label" style={{ marginRight: 2 }}>PRESETS</span>
      {presets.length === 0 && !naming && (
        <span style={{ fontSize: 11, color: 'var(--sub)' }}>Save a selection to re-run it in one click</span>
      )}
      {presets.map((p) => (
        <span key={p.name} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <button
            type="button"
            className="pill"
            data-active={activeName === p.name}
            onClick={() => onApply(p)}
            title={`${p.chars.length} character${p.chars.length !== 1 ? 's' : ''} · ${p.diffs.length} difficult${p.diffs.length !== 1 ? 'ies' : 'y'}`}
            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
          >
            {p.name}
          </button>
          <ConfirmButton
            title={`Delete preset "${p.name}"`}
            confirmLabel="✕?"
            className="danger-hover"
            onConfirm={() => onDelete(p.name)}
            style={{
              border: '1px solid var(--border)', borderLeft: 'none',
              borderRadius: '0 10px 10px 0', fontSize: 10, padding: '2px 6px',
              background: 'var(--surf2)',
            }}
          >
            ✕
          </ConfirmButton>
        </span>
      ))}
      {naming ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setName(''); setNaming(false) }
          }}
          onBlur={commit}
          placeholder="Preset name…"
          aria-label="Preset name"
          maxLength={40}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 10, width: 140,
            border: '1px solid var(--accent)', background: 'var(--surf)', color: 'var(--text)',
            outline: 'none', userSelect: 'text',
          }}
        />
      ) : (
        <button
          type="button"
          className="pill"
          disabled={!canSave}
          onClick={() => setNaming(true)}
          title={canSave ? 'Save the current characters + difficulties as a preset' : 'Select characters and difficulties first'}
          style={{ background: 'none', opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'default' }}
        >
          + Save current
        </button>
      )}
    </div>
  )
}
