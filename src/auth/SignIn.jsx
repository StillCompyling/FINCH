import { useState, useEffect } from 'react'
import { supabase } from '../db/supabase.js'

const RL_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const RL_MAX = 3

function rlKey(email) {
  return `finch:rl:${email.toLowerCase().trim()}`
}

function getWindowedTimes(email) {
  try {
    const times = JSON.parse(localStorage.getItem(rlKey(email)) ?? '[]')
    const cutoff = Date.now() - RL_WINDOW_MS
    return times.filter((t) => t > cutoff)
  } catch {
    return []
  }
}

function recordSend(email) {
  const times = getWindowedTimes(email)
  times.push(Date.now())
  localStorage.setItem(rlKey(email), JSON.stringify(times))
}

/** Returns ms until the oldest in-window request expires, or 0 if not blocked. */
function blockedForMs(email) {
  const times = getWindowedTimes(email)
  if (times.length < RL_MAX) return 0
  return times[0] + RL_WINDOW_MS - Date.now()
}

export function SignIn() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(0)   // ms remaining
  const [resend, setResend]   = useState(0)   // seconds after send

  // Tick the rate-limit countdown.
  useEffect(() => {
    if (blocked <= 0) return
    const id = setInterval(() => {
      const ms = blockedForMs(email)
      setBlocked(ms)
      if (ms <= 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [blocked > 0, email]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tick the post-send resend countdown.
  useEffect(() => {
    if (resend <= 0) return
    const id = setInterval(() => setResend((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [resend > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ms = blockedForMs(email)
    if (ms > 0) { setBlocked(ms); return }

    setLoading(true)
    setError(null)
    recordSend(email)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
      setResend(60)
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6">
        <div className="w-full max-w-xs">
          <Wordmark />
          <div className="rounded-[8px] border-[1.5px] border-ink bg-white p-6 shadow-card text-center">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">✓ Link sent</p>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              Check <strong>{email}</strong> and click the sign-in link.
            </p>
            <p className="mt-1.5 font-mono text-[0.65rem] text-ink-soft/70">
              Not there? Check your spam folder.
            </p>
            <div className="mt-5 flex flex-col gap-2 text-center">
              {resend > 0 ? (
                <p className="font-mono text-xs text-ink-soft/60">Resend available in {resend}s</p>
              ) : (
                <button
                  onClick={() => setSent(false)}
                  className="font-mono text-xs text-ink-soft underline underline-offset-2"
                >
                  Resend link
                </button>
              )}
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="font-mono text-xs text-ink-soft/50 underline underline-offset-2"
              >
                Use a different email
              </button>
            </div>
          </div>
          <p className="mt-4 px-1 text-center font-mono text-[0.6rem] leading-relaxed text-ink-soft/50">
            The link must be opened in this same browser.
            If you clicked it on a different device, request a new link here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6">
      <div className="w-full max-w-xs">
        <Wordmark sub="Personal Finance" />

        <form
          onSubmit={handleSubmit}
          className="rounded-[8px] border-[1.5px] border-ink bg-white p-6 shadow-card"
        >
          <p className="mb-4 text-sm leading-relaxed text-ink">
            Enter your email — we&rsquo;ll send you a sign-in link. No password needed.
          </p>
          <label className="mb-1.5 block font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-soft">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mb-4 w-full rounded-[6px] border-[1.5px] border-ink bg-paper px-3 py-2.5
              font-mono text-sm text-ink placeholder:text-ink-soft/50
              focus:outline-none focus:ring-2 focus:ring-ink/20"
          />

          {blocked > 0 ? (
            <div className="rounded-[6px] border-[1.5px] border-ink bg-paper-raised px-4 py-3 text-center">
              <p className="font-mono text-xs text-ink-soft">
                Please wait {Math.ceil(blocked / 1000)}s before requesting another link.
              </p>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[6px] border-[1.5px] border-ink bg-pink px-5 py-2.5
                font-mono text-sm font-bold uppercase tracking-[0.06em] text-ink shadow-card
                transition-transform active:translate-x-[2px] active:translate-y-[2px]
                active:shadow-none disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send sign in link'}
            </button>
          )}

          {error && <p className="mt-3 font-mono text-xs text-red-600">{error}</p>}
        </form>

        <p className="mt-6 text-center font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-soft/60">
          No password required
        </p>
      </div>
    </div>
  )
}

function Wordmark({ sub }) {
  return (
    <div className="mb-8 text-center">
      <h1
        className="font-display text-5xl font-bold tracking-[-0.02em] text-ink"
        style={{ fontFamily: 'Times New Roman, serif' }}
      >
        FINCH
      </h1>
      {sub && (
        <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-soft">{sub}</p>
      )}
    </div>
  )
}
