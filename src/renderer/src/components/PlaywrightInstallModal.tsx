import React, { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

type Phase = 'idle' | 'installing' | 'done' | 'error'

export default function PlaywrightInstallModal({ open, onClose }: Props): JSX.Element | null {
  const [phase, setPhase] = useState<Phase>('idle')
  const [percent, setPercent] = useState(0)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const unsubRef = useRef<(() => void) | null>(null)

  // Reset when modal re-opens
  useEffect(() => {
    if (open) {
      setPhase('idle')
      setPercent(0)
      setMessage('')
      setErrorMsg('')
    }
  }, [open])

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      unsubRef.current?.()
    }
  }, [])

  if (!open) return null

  const handleInstall = async () => {
    setPhase('installing')
    setPercent(0)
    setMessage('Starting…')
    setErrorMsg('')

    // Subscribe to progress events
    const unsub = window.api.onPlaywrightProgress((progress) => {
      setPercent(progress.percent)
      setMessage(progress.message)
      if (progress.percent >= 100) {
        setPhase('done')
      }
    })
    unsubRef.current = unsub

    try {
      await window.api.installPlaywright()
    } catch (err: any) {
      setPhase('error')
      setErrorMsg(err?.message ?? String(err))
    }
  }

  const handleClose = () => {
    unsubRef.current?.()
    unsubRef.current = null
    onClose()
  }

  return (
    <div
      data-testid="playwright-install-modal"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'var(--surf)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '28px 32px', minWidth: 380, maxWidth: 480,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>
          Install Playwright Browser
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--sub)', lineHeight: 1.5 }}>
          Simdragosa uses Playwright to automate Raidbots submissions.
          A one-time browser download (~150 MB) is required.
        </p>

        {phase === 'error' && (
          <div style={{
            background: '#3a0000', border: '1px solid #a00', borderRadius: 6,
            padding: '10px 14px', fontSize: 12, color: '#f88', lineHeight: 1.5,
          }}>
            <strong>Error:</strong> {errorMsg || 'Installation failed.'}
            {errorMsg.toLowerCase().includes('python') && (
              <div style={{ marginTop: 6, color: 'var(--sub)' }}>
                Make sure Python 3.10+ is installed from{' '}
                <strong>python.org</strong> and not the Microsoft Store version.
                Disable the Python App Execution Aliases in{' '}
                <em>Settings → Apps → Advanced app settings → App execution aliases</em>.
              </div>
            )}
          </div>
        )}

        {(phase === 'installing' || phase === 'done') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden',
              }}
            >
              <div style={{
                width: `${percent}%`, height: '100%',
                background: phase === 'done' ? 'var(--green)' : 'var(--accent)',
                transition: 'width 0.3s ease',
              }} />
            </div>
            {message && (
              <div style={{ fontSize: 12, color: 'var(--sub)' }}>{message}</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          {phase !== 'done' && (
            <button
              onClick={handleClose}
              style={{
                padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--sub)', cursor: 'pointer', fontSize: 13,
              }}
            >
              Cancel
            </button>
          )}

          {(phase === 'idle' || phase === 'error') && (
            <button
              onClick={handleInstall}
              style={{
                padding: '6px 16px', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
              }}
            >
              {phase === 'error' ? 'Retry' : 'Install'}
            </button>
          )}

          {phase === 'installing' && (
            <button
              disabled
              style={{
                padding: '6px 16px', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', cursor: 'not-allowed',
                fontSize: 13, fontWeight: 600, opacity: 0.6,
              }}
            >
              Installing…
            </button>
          )}

          {phase === 'done' && (
            <button
              onClick={handleClose}
              style={{
                padding: '6px 16px', borderRadius: 6, border: 'none',
                background: 'var(--green)', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
