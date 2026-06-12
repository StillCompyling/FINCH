import { useState } from 'react'
import { supabase } from '../db/supabase.js'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6">
      <div className="w-full max-w-xs">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <h1
            className="font-display text-5xl font-bold tracking-[-0.02em] text-ink"
            style={{ fontFamily: 'Times New Roman, serif' }}
          >
            FINCH
          </h1>
          <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-soft">
            Personal Finance
          </p>
        </div>

        {sent ? (
          <div className="rounded-[8px] border-[1.5px] border-ink bg-white p-6 shadow-card text-center">
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">
              ✓ Magic link sent
            </div>
            <p className="text-sm leading-relaxed text-ink">
              Check <strong>{email}</strong> — click the link to sign in.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="mt-4 font-mono text-xs text-ink-soft underline underline-offset-2"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-[8px] border-[1.5px] border-ink bg-white p-6 shadow-card"
          >
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
            {error && (
              <p className="mt-3 font-mono text-xs text-red-600">{error}</p>
            )}
          </form>
        )}

        <p className="mt-6 text-center font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-soft/60">
          No password required
        </p>
      </div>
    </div>
  )
}
