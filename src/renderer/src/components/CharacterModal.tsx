import React, { useEffect, useState } from 'react'
import type { Character } from '../../../shared/ipc'

interface Props {
  open: boolean
  character?: Character
  onClose: () => void
  onSave: (char: Omit<Character, 'id'> & { id?: string }) => void
}

const REGIONS = ['us', 'eu', 'tw', 'kr', 'cn']

const SPECS: Array<{ name: string; id: number }> = [
  { name: 'Fire', id: 63 }, { name: 'Frost', id: 64 }, { name: 'Arcane', id: 62 },
  { name: 'Arms', id: 71 }, { name: 'Fury', id: 72 }, { name: 'Protection (Warrior)', id: 73 },
  { name: 'Holy (Paladin)', id: 65 }, { name: 'Protection (Paladin)', id: 66 }, { name: 'Retribution', id: 70 },
  { name: 'Beast Mastery', id: 253 }, { name: 'Marksmanship', id: 254 }, { name: 'Survival', id: 255 },
  { name: 'Balance', id: 102 }, { name: 'Feral', id: 103 }, { name: 'Guardian', id: 104 }, { name: 'Restoration (Druid)', id: 105 },
  { name: 'Blood', id: 250 }, { name: 'Frost (DK)', id: 251 }, { name: 'Unholy', id: 252 },
  { name: 'Discipline', id: 256 }, { name: 'Holy (Priest)', id: 257 }, { name: 'Shadow', id: 258 },
  { name: 'Assassination', id: 259 }, { name: 'Outlaw', id: 260 }, { name: 'Subtlety', id: 261 },
  { name: 'Elemental', id: 262 }, { name: 'Enhancement', id: 263 }, { name: 'Restoration (Shaman)', id: 264 },
  { name: 'Affliction', id: 265 }, { name: 'Demonology', id: 266 }, { name: 'Destruction', id: 267 },
  { name: 'Brewmaster', id: 268 }, { name: 'Windwalker', id: 269 }, { name: 'Mistweaver', id: 270 },
  { name: 'Havoc', id: 577 }, { name: 'Vengeance', id: 581 },
  { name: 'Devastation', id: 1467 }, { name: 'Preservation', id: 1468 }, { name: 'Augmentation', id: 1473 },
]

const blank = (): Omit<Character, 'id'> => ({
  name: '', realm: '', region: 'us', spec: 'Fire', spec_id: 63, loot_spec_id: 63,
  simc_string: '', crafted_stats: '36/49',
})

export default function CharacterModal({ open, character, onClose, onSave }: Props): JSX.Element | null {
  const [form, setForm] = useState<Omit<Character, 'id'> & { id?: string }>(
    character ? { ...character } : blank()
  )

  useEffect(() => {
    setForm(character ? { ...character } : blank())
  }, [character, open])

  if (!open) return null

  const setField = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }))

  const handleSpecChange = (specId: number) => {
    const found = SPECS.find((s) => s.id === specId)
    setForm((f) => ({
      ...f,
      spec_id: specId,
      loot_spec_id: specId,
      spec: found ? found.name.split(' ')[0] : f.spec,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        data-testid="character-modal"
        onSubmit={handleSubmit}
        style={{
          background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 24, width: 480, display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700 }}>
          {character ? 'Edit Character' : 'Add Character'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="field-name" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>Name</label>
          <input
            id="field-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="field-realm" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>Realm</label>
          <input
            id="field-realm"
            value={form.realm}
            onChange={(e) => setField('realm', e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="field-region" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>Region</label>
          <select
            id="field-region"
            value={form.region}
            onChange={(e) => setField('region', e.target.value)}
            style={inputStyle}
          >
            {REGIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="field-spec_id" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>Spec ID</label>
          <select
            id="field-spec_id"
            value={form.spec_id}
            onChange={(e) => handleSpecChange(Number(e.target.value))}
            style={inputStyle}
          >
            {SPECS.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="field-simc_string" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>SimC String</label>
          <textarea
            id="field-simc_string"
            value={form.simc_string}
            onChange={(e) => setField('simc_string', e.target.value)}
            rows={5}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button type="submit" style={primaryBtn}>Save</button>
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 5,
  color: 'var(--text)', padding: '6px 10px', fontSize: 13, width: '100%',
  outline: 'none',
}
const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5,
  padding: '7px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const secondaryBtn: React.CSSProperties = {
  background: 'var(--surf2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 20px', fontSize: 13, cursor: 'pointer',
}
