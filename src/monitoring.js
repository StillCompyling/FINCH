/**
 * Sentry error monitoring — initialises only when VITE_SENTRY_DSN is set.
 *
 * Setup:
 *   1. npm install @sentry/react
 *   2. Add VITE_SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz to Vercel env vars
 *   3. This file auto-activates on the next deploy — no further code changes needed.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN

export async function initMonitoring() {
  if (!DSN) return
  const Sentry = await import('@sentry/react')
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (window.location.hostname === 'localhost') return null
      return event
    },
  })
}
