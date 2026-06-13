import { todayISO, currentMonthKey, addMonths } from '../utils/dates.js'

/**
 * First-run example data so charts and projections aren't empty.
 * Marked with `seed: true` so we could offer "clear examples" later.
 */

// Stable IDs — used for palette-migration (StoreProvider compares stored
// category colors against these defaults) and for useSetting lookups.
// Row IDs in Supabase are namespaced per-user in database.js so these
// stable strings never cause PK conflicts across users.
export const DEFAULT_CATEGORIES = [
  { id: 'cat-rent',          name: 'Rent / Bills',  color: '#0e3d24', icon: 'home' },
  { id: 'cat-groceries',     name: 'Groceries',     color: '#14532d', icon: 'basket' },
  { id: 'cat-dining',        name: 'Dining',        color: '#178a4c', icon: 'utensils' },
  { id: 'cat-transport',     name: 'Transport',     color: '#3fa56f', icon: 'train' },
  { id: 'cat-shopping',      name: 'Shopping',      color: '#73bd94', icon: 'bag' },
  { id: 'cat-subscriptions', name: 'Subscriptions', color: '#a8d6bc', icon: 'repeat' },
  { id: 'cat-health',        name: 'Health',        color: '#5d6b4a', icon: 'heart' },
  { id: 'cat-entertainment', name: 'Entertainment', color: '#8a8576', icon: 'film' },
  { id: 'cat-other',         name: 'Other',         color: '#b5b1a4', icon: 'dots' },
]

export const LEGACY_DEFAULT_COLORS = new Set([
  '#6a9c78', '#d97757', '#5d8aa8', '#8a7e6d', '#b08bbd', '#c4554d', '#cf9b4a', '#7d79a0', '#8a867c',
  '#3f7d54', '#b3683f', '#46708e', '#6e6759', '#7d5e8c', '#a4504a', '#a8842f', '#56557e', '#83807a',
])

function day(monthKey, d) {
  return `${monthKey}-${String(d).padStart(2, '0')}`
}

export function buildSeedData() {
  const thisMonth = currentMonthKey()
  const lastMonth = addMonths(thisMonth, -1)

  const expenses = [
    { id: crypto.randomUUID(), amountCents: 4825,  categoryId: 'cat-groceries',     date: day(thisMonth, 2),  note: 'Albert Heijn weekly shop', seed: true },
    { id: crypto.randomUUID(), amountCents: 1650,  categoryId: 'cat-dining',        date: day(thisMonth, 4),  note: 'Lunch with Sam', seed: true },
    { id: crypto.randomUUID(), amountCents: 4000,  categoryId: 'cat-transport',     date: day(thisMonth, 5),  note: 'NS train top-up', seed: true },
    { id: crypto.randomUUID(), amountCents: 89500, categoryId: 'cat-rent',          date: day(thisMonth, 1),  note: 'Rent', seed: true },
    { id: crypto.randomUUID(), amountCents: 3299,  categoryId: 'cat-shopping',      date: day(thisMonth, 8),  note: 'Bookshop', seed: true },
    { id: crypto.randomUUID(), amountCents: 5210,  categoryId: 'cat-groceries',     date: day(thisMonth, 9),  note: 'Albert Heijn weekly shop', seed: true },
    { id: crypto.randomUUID(), amountCents: 89500, categoryId: 'cat-rent',          date: day(lastMonth, 1),  note: 'Rent', seed: true },
    { id: crypto.randomUUID(), amountCents: 6120,  categoryId: 'cat-groceries',     date: day(lastMonth, 6),  note: 'Groceries', seed: true },
    { id: crypto.randomUUID(), amountCents: 2890,  categoryId: 'cat-entertainment', date: day(lastMonth, 14), note: 'Cinema', seed: true },
    { id: crypto.randomUUID(), amountCents: 7450,  categoryId: 'cat-dining',        date: day(lastMonth, 21), note: 'Dinner out', seed: true },
  ]

  const recurring = [
    {
      id: crypto.randomUUID(), name: 'Netflix', amountCents: 1599, cycle: 'monthly',
      startDate: day(addMonths(thisMonth, -6), 15), categoryId: 'cat-subscriptions',
      status: 'active', seed: true,
    },
    {
      id: crypto.randomUUID(), name: 'Spotify', amountCents: 1099, cycle: 'monthly',
      startDate: day(addMonths(thisMonth, -12), 3), categoryId: 'cat-subscriptions',
      status: 'active', seed: true,
    },
    {
      id: crypto.randomUUID(), name: 'Gym', amountCents: 2999, cycle: 'monthly',
      startDate: day(addMonths(thisMonth, -3), 1), categoryId: 'cat-health',
      status: 'active', seed: true,
    },
  ]

  const goals = []

  const settings = [
    { id: 'theme',    value: 'system' },
    { id: 'seededAt', value: todayISO() },
  ]

  return { expenses, recurring, categories: DEFAULT_CATEGORIES, goals, settings }
}
