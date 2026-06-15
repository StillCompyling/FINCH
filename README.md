# Finch — personal expense tracker

A calm, local-first expense tracker. Progressive Web App: runs in the browser on
macOS, installs to the iOS home screen via **Share → Add to Home Screen**, and
works offline. All data stays on your device in IndexedDB — no account, no server.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (recurrence math, CSV parsing)
```

> The PWA service worker is only generated in production builds. To test
> installability and offline support locally:
>
> ```bash
> npm run build && npm run preview
> ```

## Features

- **Expenses** — add/edit/delete; amount, category, date, note. The green
  "Add expense" button is always one tap away.
- **Categories** — nine defaults in a tonal green/neutral palette; add, rename,
  recolor in Settings. Fully data-driven.
- **Monthly overview** — month tabs; total spent, delta vs. previous month,
  category donut, daily-bars + cumulative-line trend with last month as a
  dashed reference. All charts in the green accent family.
- **Goals** — budget per month, week, or custom range; overall or per-category.
  Color-coded: green under 70%, amber 70–100%, red over. Shows spent / budget /
  remaining and percent.
- **Subscriptions** — recurring expenses (weekly/monthly/quarterly/yearly).
  They automatically count toward month totals and goals. Each shows a 1/2/5/10-year
  cost ladder; a combined headline shows what all subscriptions really cost.
  Pause or archive (history kept).
- **CSV import** — map your bank's columns once (remembered), EU comma decimals,
  debit/credit columns and sign conventions handled, preview with skip toggles,
  duplicates (same date + amount + description) excluded automatically.
- **Backup** — Settings → Export all data (JSON download) / Import from backup.

## Deploy

Static site — any static host over **HTTPS** works (HTTPS is required for the
service worker and for iOS "Add to Home Screen"). Full step-by-step commands,
host config, and iPhone install instructions are in **[DEPLOY.md](DEPLOY.md)**.

Quick version:

**Vercel** (simplest, easy redeploys): `npm i -g vercel && vercel --prod` from the
project root. `vercel.json` pins the build, SPA fallback, and SW/manifest headers.

**Netlify Drop** (no CLI): `npm run build`, then drag `dist/` onto
<https://app.netlify.com/drop>.

> Web deploy uses `npm run build`. `npm run app:build` is the separate
> Electron/macOS build and is **not** for static hosting.

## Data & persistence

- Primary store: **IndexedDB** (via `idb`), localStorage fallback.
- Every mutation writes through to storage immediately; the app fully rehydrates
  on load — data survives reloads, browser restarts, and relaunches.
- Money is stored as **integer cents** everywhere; formatting to EUR (nl-NL)
  happens only at display time.

### Per-device storage (no sync)

Each install keeps its **own** IndexedDB — the macOS app and an iPhone home-screen
install do **not** share or sync data. iOS may also **evict PWA storage under disk
pressure** or after long disuse, so treat the phone copy as convenient, not
permanent. To move data between devices or guard against eviction, use
**Settings → Export all data** (JSON) on one device and **Import from backup…** on
the other. The JSON export is the backup-and-transfer mechanism.

## Project structure

```
src/
  db/database.js            IndexedDB layer (loadAll / put / putMany / remove / replaceAll)
  store/StoreProvider.jsx   single source of truth: reducer + write-through persistence
  store/seed.js             default categories + first-run example data
  hooks/useMonthData.js     month view-model: entries (incl. recurring), totals, chart series
  hooks/useTheme.js         system/light/dark
  utils/money.js            integer-cent math, EUR formatting, EU-aware amount parsing
  utils/dates.js            "YYYY-MM" month keys and ranges
  utils/recurrence.js       cycle→annual→N-year normalization + per-month occurrences
  utils/goals.js            goal windows, spend-in-range, rating thresholds
  utils/csv.js              flexible dates, sign conventions, row normalization, de-dupe
  utils/backup.js           JSON export / validate / restore
  components/
    layout/                 Header, MonthTabs, Card
    ui/Sheet.jsx            modal sheet + shared form atoms
    expenses/               ExpenseSheet (add/edit), ExpenseList
    categories/             CategoryManager
    charts/                 DonutCard, TrendCard, shared tooltip
    goals/                  GoalsCard + GoalSheet
    recurring/              RecurringView (cost ladders, projections)
    importer/               ImportWizard (file → mapping → preview → commit)
    settings/               SettingsPanel (backup, import, categories)
tests/                      node --test suites for recurrence + CSV math
public/icons/               PWA icons
```
# HITCH
