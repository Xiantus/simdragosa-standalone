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
  { name: 'Havoc', id: 577 }, { name: 'Vengeance', id: 581 }, { name: 'Devourer', id: 1480 },
  { name: 'Devastation', id: 1467 }, { name: 'Preservation', id: 1468 }, { name: 'Augmentation', id: 1473 },
]

// ---------------------------------------------------------------------------
// SimC string parser — extracts character fields from a pasted SimC export
// ---------------------------------------------------------------------------
const SIMC_CLASS_TOKENS = new Set([
  'warrior','paladin','hunter','rogue','priest','shaman',
  'mage','warlock','monk','druid','demonhunter','deathknight','evoker',
])

// (class_token, spec_token) → { name, id }
const SIMC_SPEC_MAP: Record<string, { name: string; id: number }> = {
  'warrior/arms':           { name: 'Arms',                id: 71 },
  'warrior/fury':           { name: 'Fury',                id: 72 },
  'warrior/protection':     { name: 'Protection (Warrior)',id: 73 },
  'paladin/holy':           { name: 'Holy (Paladin)',       id: 65 },
  'paladin/protection':     { name: 'Protection (Paladin)',id: 66 },
  'paladin/retribution':    { name: 'Retribution',         id: 70 },
  'hunter/beast_mastery':   { name: 'Beast Mastery',       id: 253 },
  'hunter/marksmanship':    { name: 'Marksmanship',        id: 254 },
  'hunter/survival':        { name: 'Survival',            id: 255 },
  'rogue/assassination':    { name: 'Assassination',       id: 259 },
  'rogue/outlaw':           { name: 'Outlaw',              id: 260 },
  'rogue/subtlety':         { name: 'Subtlety',            id: 261 },
  'priest/discipline':      { name: 'Discipline',          id: 256 },
  'priest/holy':            { name: 'Holy (Priest)',        id: 257 },
  'priest/shadow':          { name: 'Shadow',              id: 258 },
  'shaman/elemental':       { name: 'Elemental',           id: 262 },
  'shaman/enhancement':     { name: 'Enhancement',         id: 263 },
  'shaman/restoration':     { name: 'Restoration (Shaman)',id: 264 },
  'mage/arcane':            { name: 'Arcane',              id: 62 },
  'mage/fire':              { name: 'Fire',                id: 63 },
  'mage/frost':             { name: 'Frost',               id: 64 },
  'warlock/affliction':     { name: 'Affliction',          id: 265 },
  'warlock/demonology':     { name: 'Demonology',          id: 266 },
  'warlock/destruction':    { name: 'Destruction',         id: 267 },
  'monk/brewmaster':        { name: 'Brewmaster',          id: 268 },
  'monk/windwalker':        { name: 'Windwalker',          id: 269 },
  'monk/mistweaver':        { name: 'Mistweaver',          id: 270 },
  'druid/balance':          { name: 'Balance',             id: 102 },
  'druid/feral':            { name: 'Feral',               id: 103 },
  'druid/guardian':         { name: 'Guardian',            id: 104 },
  'druid/restoration':      { name: 'Restoration (Druid)', id: 105 },
  'demonhunter/havoc':      { name: 'Havoc',               id: 577 },
  'demonhunter/vengeance':  { name: 'Vengeance',           id: 581 },
  'demonhunter/devourer':   { name: 'Devourer',            id: 1480 },
  'deathknight/blood':      { name: 'Blood',               id: 250 },
  'deathknight/frost':      { name: 'Frost (DK)',          id: 251 },
  'deathknight/unholy':     { name: 'Unholy',              id: 252 },
  'evoker/devastation':     { name: 'Devastation',         id: 1467 },
  'evoker/preservation':    { name: 'Preservation',        id: 1468 },
  'evoker/augmentation':    { name: 'Augmentation',        id: 1473 },
}

interface ParsedSimc {
  name?: string
  realm?: string
  region?: string
  spec?: { name: string; id: number }
}

function parseSimcString(raw: string): ParsedSimc {
  const result: ParsedSimc = {}
  let classToken: string | null = null

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue
    const key = line.slice(0, eqIdx).trim().toLowerCase()
    const val = line.slice(eqIdx + 1).trim().replace(/^"|"$/g, '')

    if (SIMC_CLASS_TOKENS.has(key)) {
      classToken = key
      result.name = val
    } else if (key === 'server' || key === 'realm') {
      result.realm = val
    } else if (key === 'region') {
      result.region = val.toLowerCase()
    } else if (key === 'spec' && classToken) {
      const specKey = `${classToken}/${val.toLowerCase()}`
      const found = SIMC_SPEC_MAP[specKey]
      if (found) result.spec = found
    }
  }

  return result
}

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

  const [simcFilled, setSimcFilled] = useState<string[]>([])

  const handleSimcChange = (raw: string) => {
    setField('simc_string', raw)
    if (raw.trim().length < 10) { setSimcFilled([]); return }
    const parsed = parseSimcString(raw)
    const filled: string[] = []
    setForm((f) => {
      const next = { ...f, simc_string: raw }
      if (parsed.name)   { next.name   = parsed.name;               filled.push('name') }
      if (parsed.realm)  { next.realm  = parsed.realm;              filled.push('realm') }
      if (parsed.region && ['us','eu','tw','kr','cn'].includes(parsed.region)) {
        next.region = parsed.region;                                 filled.push('region')
      }
      if (parsed.spec) {
        next.spec_id     = parsed.spec.id
        next.loot_spec_id = parsed.spec.id
        next.spec        = parsed.spec.name.split(' ')[0]
        filled.push('spec')
      }
      return next
    })
    setSimcFilled(filled)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000,  // above Wowhead tooltips (9999)
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        data-testid="character-modal"
        onSubmit={handleSubmit}
        style={{
          background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 24, width: 500, maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        {/* Header row with title + close button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700 }}>
            {character ? 'Edit Character' : 'Add Character'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              background: 'transparent', border: 'none', color: 'var(--sub)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--sub)' }}
          >
            ✕
          </button>
        </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor="field-simc_string" style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>
              SimC String
            </label>
            {simcFilled.length > 0 && (
              <span style={{
                fontSize: 10, color: 'var(--green, #3ecf8e)', background: 'rgba(62,207,142,0.12)',
                borderRadius: 4, padding: '1px 6px', fontWeight: 600,
              }}>
                ✓ auto-filled: {simcFilled.join(', ')}
              </span>
            )}
          </div>
          <textarea
            id="field-simc_string"
            value={form.simc_string}
            onChange={(e) => handleSimcChange(e.target.value)}
            placeholder="Paste your SimC export here — name, realm, region and spec will be filled automatically"
            rows={8}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: 11,
              userSelect: 'text',   // override body's user-select:none so text is selectable
              WebkitUserSelect: 'text',
            }}
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
  userSelect: 'text',        // body sets user-select:none globally; override for inputs
  WebkitUserSelect: 'text',
}
const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5,
  padding: '7px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const secondaryBtn: React.CSSProperties = {
  background: 'var(--surf2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 20px', fontSize: 13, cursor: 'pointer',
}
