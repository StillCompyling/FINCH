# Finch — Security Reference

Last audited: 2026-06-15

---

## Findings Summary

| # | Section | Severity | Finding | Status |
|---|---------|----------|---------|--------|
| 1 | Secrets | LOW | `.env.local` (anon key + project URL) committed in `ecaa2f6`, removed in `4e86d39`. Anon key is public by design; URL is not secret. | Noted — no key rotation needed |
| 2 | Secrets | MEDIUM | `.gitignore` only covered `.env.local` — missing `.env`, `.env.*.local`, `.env.production`, etc. | Fixed — all env patterns added |
| 3 | Rate limiting | HIGH | `api/scan-receipt.js` had no server-side rate limiting — client-side localStorage limit bypassable via curl/DevTools | Fixed — Supabase-backed server-side 10/hr limit added |
| 4 | Validation | MEDIUM | `sanitizeText` only stripped HTML tags — not `javascript:` or `on*=` event handlers | Fixed — enhanced in `src/utils/validate.js` |
| 5 | Validation | MEDIUM | `CategoryManager` saved category names without sanitization | Fixed — `sanitizeText` applied before upsert |
| 6 | Validation | MEDIUM | `RecurringView` saved subscription names without sanitization | Fixed — `sanitizeText` applied before upsert |
| 7 | Validation | MEDIUM | `api/scan-receipt.js` had no content-length check — attacker could POST unlimited payload | Fixed — 3 MB limit enforced before body read |
| 8 | Console logs | HIGH | `AuthProvider.jsx` logged user email to browser console in production | Fixed — log removed |
| 9 | Console logs | LOW | `ReceiptScanner.jsx` had 4 debug `console.log` calls (image sizes, response status) | Fixed — all removed, timeout reverted to 15s |
| 10 | Headers | MEDIUM | Missing `Strict-Transport-Security` (HSTS) | Fixed — `max-age=31536000; includeSubDomains` added |

---

## Rate Limits

| What | Where | Limit | Layer |
|------|-------|-------|-------|
| Magic link requests | `SignIn.jsx` | 3 per 10 minutes per email | Client (localStorage) |
| Receipt scans | `ReceiptScanner.jsx` | 10 per hour | Client (localStorage) |
| Receipt scans | `api/scan-receipt.js` | 10 per hour per user | **Server (Supabase settings table)** — authoritative |

Server-side limit stores timestamps in the `settings` table under `<userId>/scan-rl`. Timestamps older than 1 hour are evicted on each check.

---

## Secrets Inventory

| Secret | Location | Visibility |
|--------|----------|------------|
| `VITE_SUPABASE_URL` | Vercel env vars (VITE_ prefix) | Public — in browser bundle by design |
| `VITE_SUPABASE_ANON_KEY` | Vercel env vars (VITE_ prefix) | Public — anon key, RLS enforces data isolation |
| `GEMINI_API_KEY` | Vercel env vars (no VITE_ prefix) | Server-only — never in browser bundle |
| `SUPABASE_URL` | Vercel env vars (no VITE_ prefix) | Server-only (same value as VITE_ but isolated) |
| `SUPABASE_SERVICE_KEY` | Vercel env vars (no VITE_ prefix) | Server-only — bypasses RLS, never exposed |

The `SUPABASE_SERVICE_KEY` is used only in `api/scan-receipt.js` to verify JWTs and write rate-limit records. It never appears in `src/` or the built bundle.

---

## CSP Allowlist

Header: `Content-Security-Policy` in `vercel.json`

| Directive | Allowed origins | Reason |
|-----------|----------------|--------|
| `default-src` | `'self'` | Catch-all fallback |
| `script-src` | `'self' 'unsafe-inline' https://vercel.live` | App scripts; `unsafe-inline` for Vite inline scripts; Vercel feedback widget |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Tailwind inline styles; Google Fonts CSS |
| `font-src` | `'self' https://fonts.gstatic.com data:` | Space Mono and Silkscreen font files |
| `img-src` | `'self' data: blob:` | Data URLs for icons; blob URLs for receipt thumbnails |
| `connect-src` | `'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com https://generativelanguage.googleapis.com` | Supabase REST + realtime; font fetches by service worker; Gemini via server proxy |
| `frame-src` | `https://vercel.live` | Vercel deployment feedback widget |
| `frame-ancestors` | `'none'` | Prevents clickjacking — no one may frame Finch |

---

## Input Validation

All user text input passes through `sanitizeText` in `src/utils/validate.js` before saving to Supabase. Strips:
- HTML tags (`<script>`, `<img>`, etc.)
- `javascript:` protocol
- Inline event handlers (`onclick=`, `onload=`, etc.)

Field-level limits enforced client-side (and implicitly by Supabase JSONB storage):

| Field | Max length | Validator |
|-------|-----------|-----------|
| Expense note | 500 chars | `validateExpense` |
| Category name | 50 chars | `validateCategory` |
| Subscription name | 100 chars | `validateRecurring` |
| Email (sign-in) | Browser `type="email"` | HTML5 native |
| Amount (all forms) | €999,999.99 (99,999,999 cents) | `validateExpense` / `validateRecurring` |

---

## Supabase RLS

All 5 tables (`expenses`, `recurring`, `categories`, `goals`, `settings`) have RLS enabled with:

```sql
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
```

This policy covers SELECT, INSERT, UPDATE, and DELETE. No permissive `USING (true)` policies exist. The anon key can only access rows belonging to the authenticated user.

To verify RLS is active at any time:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

---

## Remaining Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `unsafe-inline` in `script-src` | MEDIUM | Required by Vite. Mitigated by `frame-ancestors 'none'` and no user-controlled script execution paths. |
| Client-side rate limits bypassable on same device (clear localStorage) | LOW | Server-side rate limit on scan-receipt is the authoritative gate. Sign-in rate limit is best-effort; Supabase has its own server-side OTP rate limits. |
| Git history contains `.env.local` with anon key (commit `ecaa2f6`) | LOW | Anon key is public by design; URL is not a secret. To fully purge: `git filter-repo --path .env.local --invert-paths` then force-push (requires all collaborators to re-clone). |
| No CSRF protection on `/api/scan-receipt` | LOW | Edge function validates `Authorization: Bearer` header — CSRF attacks cannot set custom headers cross-origin. |

---

## Credential Rotation

If any secret is compromised:

**VITE_SUPABASE_ANON_KEY** — Supabase dashboard → Project Settings → API → Regenerate anon key → update Vercel env var → redeploy.

**SUPABASE_SERVICE_KEY** — Supabase dashboard → Project Settings → API → Regenerate service_role key → update Vercel env var → redeploy. Audit any logs for unauthorized use before rotating.

**GEMINI_API_KEY** — Google AI Studio → API keys → Delete key → create new → update Vercel env var → redeploy.

After any rotation: redeploy immediately (`vercel --prod`) and verify the health endpoint returns 200.

---

## Security Disclosure

To report a security vulnerability, open a private GitHub security advisory or email the project owner directly. Do not file a public issue for security vulnerabilities.
