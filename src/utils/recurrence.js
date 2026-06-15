import { daysInMonth } from './dates.js'

/**
 * Recurring-expense math. Two responsibilities, both pure:
 *
 *  1. occurrencesInMonth — which concrete charges a recurring expense
 *     produces in a given month (these feed period totals and goals).
 *  2. projectCost — cycle → annualized cost → N-year projection.
 *     This is THE normalization function; keep all cycle math here.
 */

export const CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly']

const PERIODS_PER_YEAR = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
}

/** Annualized cost in cents for one recurring expense. */
export function annualizedCents(amountCents, cycle) {
  const periods = PERIODS_PER_YEAR[cycle]
  if (!periods) throw new Error(`Unknown billing cycle: ${cycle}`)
  return amountCents * periods
}

/** Monthly-equivalent cost in cents (annualized / 12). */
export function monthlyizedCents(amountCents, cycle) {
  return Math.round(annualizedCents(amountCents, cycle) / 12)
}

/**
 * Projected total cost in cents over `years` years.
 * projectCost(1599, 'monthly', 10) -> 1599 * 12 * 10
 */
export function projectCost(amountCents, cycle, years) {
  return annualizedCents(amountCents, cycle) * years
}

/** Standard projection horizons shown in the UI. */
export const PROJECTION_YEARS = [1, 2, 5, 10]

export function projectionLadder(amountCents, cycle) {
  return PROJECTION_YEARS.map((years) => ({
    years,
    totalCents: projectCost(amountCents, cycle, years),
  }))
}

/* ---------------- occurrences within a month ---------------- */

function parseISO(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { y, m, d }
}

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Concrete billing dates a recurring expense produces inside `monthKey`
 * ("YYYY-MM"). Respects startDate; paused/archived items produce none.
 * Monthly/quarterly/yearly bill on the start day-of-month (clamped to
 * month length, e.g. start on the 31st bills Feb 28). Weekly bills every
 * 7 days from startDate.
 */
export function occurrencesInMonth(recurring, monthKey) {
  if (recurring.status !== 'active') return []
  const start = parseISO(recurring.startDate)
  const [year, month] = monthKey.split('-').map(Number)
  const dim = daysInMonth(monthKey)
  const monthStartMs = Date.UTC(year, month - 1, 1)
  const monthEndMs = Date.UTC(year, month - 1, dim)
  const startMs = Date.UTC(start.y, start.m - 1, start.d)

  if (startMs > monthEndMs) return []

  const dates = []

  if (recurring.cycle === 'weekly') {
    const WEEK = 7 * 86400000
    // First occurrence on/after month start
    const offset = Math.max(0, Math.ceil((monthStartMs - startMs) / WEEK))
    for (let t = startMs + offset * WEEK; t <= monthEndMs; t += WEEK) {
      if (t >= monthStartMs) {
        const dt = new Date(t)
        dates.push(iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()))
      }
    }
  } else {
    const stepMonths = { monthly: 1, quarterly: 3, yearly: 12 }[recurring.cycle]
    if (!stepMonths) throw new Error(`Unknown billing cycle: ${recurring.cycle}`)
    const monthsSinceStart = (year - start.y) * 12 + (month - start.m)
    if (monthsSinceStart >= 0 && monthsSinceStart % stepMonths === 0) {
      const day = Math.min(start.d, dim)
      // Skip if the billing day in the start month is still in the future
      if (!(monthsSinceStart === 0 && day < start.d)) {
        dates.push(iso(year, month, day))
      }
    }
  }

  return dates.map((date) => ({
    date,
    amountCents: recurring.amountCents,
    recurringId: recurring.id,
    name: recurring.name,
    categoryId: recurring.categoryId ?? null,
  }))
}

/** All recurring charges for a list of recurring expenses in one month. */
export function allOccurrencesInMonth(recurringList, monthKey) {
  return recurringList.flatMap((r) => occurrencesInMonth(r, monthKey))
}

function monthKeyOfISO(dateStr) {
  return dateStr.slice(0, 7)
}

function nextMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m, 1) // m is 1-based → this is the next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * All recurring charges across an inclusive [fromISO, toISO] date range.
 * Built on occurrencesInMonth (one source of truth for billing dates), then
 * filtered to the window — the range may span month boundaries.
 */
export function occurrencesInRange(recurringList, fromISO, toISO) {
  const out = []
  let mk = monthKeyOfISO(fromISO)
  const endMk = monthKeyOfISO(toISO)
  while (mk <= endMk) {
    for (const occ of allOccurrencesInMonth(recurringList, mk)) {
      if (occ.date >= fromISO && occ.date <= toISO) out.push(occ)
    }
    if (mk === endMk) break
    mk = nextMonthKey(mk)
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
