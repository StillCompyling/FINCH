# Finch — Launch Checklist

## Environment Variables

Set these in Vercel → Project → Settings → Environment Variables (Production):

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon / public key |
| `VITE_SENTRY_DSN` | Sentry → Project → Settings → SDK Setup → DSN (optional, activates error tracking) |

---

## Section 1 — Resend SMTP (critical for launch day)

Supabase's built-in email is rate-limited to **3 emails/hour** on the free tier. Set up Resend before launch:

1. Create account at [resend.com](https://resend.com) → free tier is 3,000 emails/month
2. Add your sending domain (or use the `onboarding@resend.dev` sandbox for testing)
3. Create an API key: Resend → API Keys → Create API Key (copy it)
4. In Supabase → Auth → Settings → SMTP Settings:
   - Enable custom SMTP: **on**
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: `<your Resend API key>`
   - Sender email: `noreply@yourdomain.com` (must be verified in Resend)
   - Sender name: `Finch`
5. Click Save and send a test email from the Supabase UI

---

## Section 2 — Supabase Auth Settings

In Supabase → Auth → Settings:

- [ ] **Enable email sign-in**: on
- [ ] **Email confirmations**: off (magic link IS the confirmation)
- [ ] **Secure email change**: on
- [ ] **Site URL**: set to your Vercel production URL (e.g. `https://finch.vercel.app`)
- [ ] **Redirect URLs**: add:
  - `http://localhost:5173` (dev)
  - `https://your-vercel-url.vercel.app` (production)
  - Any custom domain if applicable
- [ ] **JWT expiry**: 3600 (default) or longer for better UX

---

## Section 3 — Sentry Setup (optional but recommended)

1. Create account at [sentry.io](https://sentry.io) → create a new React project
2. Copy the DSN from: Sentry → Project → Settings → SDK Setup
3. Add `VITE_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz` to Vercel env vars
4. Redeploy — monitoring activates automatically (no code changes needed)
5. Sentry stays **off** on localhost automatically

---

## Section 4 — Database Schema Verification

Confirm in Supabase → Table Editor that all 5 tables exist with RLS enabled:

- [ ] `expenses` — id TEXT PK, user_id UUID, data JSONB, updated_at TIMESTAMPTZ
- [ ] `recurring` — same shape
- [ ] `categories` — same shape
- [ ] `goals` — same shape
- [ ] `settings` — same shape
- [ ] All tables: RLS enabled ✓
- [ ] Each table: policy `FOR ALL USING (auth.uid() = user_id)` ✓

If tables don't exist, run `supabase/schema.sql` in Supabase → SQL Editor.

---

## Pre-Launch Smoke Test

Run this full flow before announcing:

### New user sign-in
- [ ] Open the app in a fresh browser (incognito)
- [ ] Enter your email on the sign-in screen
- [ ] Check inbox, click the magic link
- [ ] App loads with boot screen then overview
- [ ] Welcome card appears (no expenses yet)
- [ ] Example/seed data loads correctly

### Core features
- [ ] **Add expense**: tap +, fill amount/category/date/note, save — appears in list
- [ ] **Edit expense**: tap an expense, change amount, save — reflects immediately
- [ ] **Delete expense**: tap, multi-select, delete — removed from list
- [ ] **Set a goal**: Goals card → set a monthly budget → progress bar appears
- [ ] **Add subscription**: Subscriptions tab → add recurring → appears in list
- [ ] **Trends tab**: shows multi-month chart (may be sparse if new)

### Persistence
- [ ] Sign out (Settings → Account → Sign out)
- [ ] Sign back in with same email
- [ ] All data still present — confirms Supabase persistence

### Multi-device
- [ ] Open app in a second browser / device
- [ ] Sign in with same email
- [ ] Same data appears — confirms shared store works

### Error + edge cases
- [ ] Request magic link 3× quickly — rate limit message appears with countdown
- [ ] Go offline (airplane mode) — offline banner appears
- [ ] Come back online — banner disappears

### PWA
- [ ] On iOS Safari: Share → Add to Home Screen → app launches full-screen
- [ ] On Android Chrome: Install app prompt → app launches standalone

---

## Security Headers Verification

After deploying, check headers at [securityheaders.com](https://securityheaders.com):

- [ ] `Content-Security-Policy` present
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`

---

## Health Check

`GET /health` should return `{"status":"ok","app":"finch"}` with HTTP 200.

Set up an uptime monitor (UptimeRobot free tier) pointed at `https://your-domain.com/health`.
