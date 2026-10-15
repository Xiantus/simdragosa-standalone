import React, { useEffect, useState } from 'react'

interface Props {
  raidsid: string
  onRaidsidChange: (raidsid: string) => void
  /** Field id, so the surrounding form's <label> can point at the paste input. */
  inputId: string
}

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'signing-in' }
  | { kind: 'ok'; user: string | null }
  | { kind: 'expired' }
  | { kind: 'error'; message: string }

/**
 * Raidbots session: a "Sign in" button that captures the cookie from a real
 * login window, a live check of whether the current session still works, and
 * the old paste-the-cookie field tucked away for anyone who prefers it.
 */
export default function RaidbotsSignIn({ raidsid, onRaidsidChange, inputId }: Props): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [showPaste, setShowPaste] = useState(false)

  const check = async (value: string) => {
    if (!value.trim()) { setStatus({ kind: 'idle' }); return }
    setStatus({ kind: 'checking' })
    try {
      const res = await window.api.checkRaidbotsSession(value.trim())
      if (res.ok) setStatus({ kind: 'ok', user: res.user ?? null })
      else if (res.user === null) setStatus({ kind: 'expired' })
      else setStatus({ kind: 'error', message: res.error ?? 'Could not check the session' })
    } catch (err: any) {
      setStatus({ kind: 'error', message: err?.message ?? 'Could not check the session' })
    }
  }

  // Check whatever is saved when the panel opens.
  useEffect(() => { check(raidsid) }, [])

  const signIn = async () => {
    setStatus({ kind: 'signing-in' })
    try {
      const res = await window.api.loginRaidbots()
      if (res.ok && res.raidsid) {
        onRaidsidChange(res.raidsid)
        setStatus({ kind: 'ok', user: res.user ?? null })
      } else {
        setStatus(raidsid ? { kind: 'idle' } : { kind: 'error', message: res.error ?? 'Sign-in did not finish' })
        if (raidsid) check(raidsid)
      }
    } catch (err: any) {
      setStatus({ kind: 'error', message: err?.message ?? 'Sign-in failed' })
    }
  }

  const statusLine = (() => {
    switch (status.kind) {
      case 'checking':   return { color: 'var(--sub)', text: 'Checking session…' }
      case 'signing-in': return { color: 'var(--sub)', text: 'Finish signing in in the Raidbots window…' }
      case 'ok':         return { color: 'var(--green)', text: status.user ? `✓ Signed in as ${status.user}` : '✓ Signed in' }
      case 'expired':    return { color: 'var(--red)', text: '⚠ Session expired — sign in again' }
      case 'error':      return { color: 'var(--yellow)', text: `⚠ ${status.message}` }
      default:           return raidsid ? null : { color: 'var(--sub)', text: 'Not signed in' }
    }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={signIn}
          disabled={status.kind === 'signing-in'}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5,
            padding: '6px 14px', fontSize: 12, fontWeight: 700,
            cursor: status.kind === 'signing-in' ? 'wait' : 'pointer',
          }}
        >
          {status.kind === 'ok' ? 'Switch account' : 'Sign in to Raidbots'}
        </button>
        {raidsid && (
          <button
            type="button"
            className="pill"
            onClick={() => check(raidsid)}
            disabled={status.kind === 'checking'}
            style={{ borderRadius: 5 }}
          >
            Test session
          </button>
        )}
        {statusLine && (
          <span data-testid="raidbots-status" style={{ fontSize: 11, color: statusLine.color }}>
            {statusLine.text}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowPaste((v) => !v)}
        aria-expanded={showPaste}
        style={{
          alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--sub)', fontSize: 11, padding: 0,
        }}
      >
        {showPaste ? '▾' : '▸'} Paste the raidsid cookie instead
      </button>
      {showPaste && (
        <>
          <input
            id={inputId}
            type="text"
            value={raidsid}
            onChange={(e) => onRaidsidChange(e.target.value)}
            onBlur={(e) => check(e.target.value)}
            placeholder="paste your raidsid cookie value here"
            style={{
              background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--text)', padding: '6px 10px', fontSize: 13, width: '100%',
              outline: 'none', userSelect: 'text', WebkitUserSelect: 'text',
            } as React.CSSProperties}
          />
          <span style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>
            Log in to raidbots.com, then open DevTools (F12) → Application → Cookies → copy the{' '}
            <code style={{ background: 'var(--surf2)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>raidsid</code> value.
          </span>
        </>
      )}
    </div>
  )
}
