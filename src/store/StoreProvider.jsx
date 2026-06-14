import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import * as db from '../db/database.js'

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

const LEGACY_DEFAULT_COLORS = new Set([
  '#6a9c78', '#d97757', '#5d8aa8', '#8a7e6d', '#b08bbd', '#c4554d', '#cf9b4a', '#7d79a0', '#8a867c',
  '#3f7d54', '#b3683f', '#46708e', '#6e6759', '#7d5e8c', '#a4504a', '#a8842f', '#56557e', '#83807a',
])

const StoreContext = createContext(null)

const COLLECTION_OF = {
  expense: 'expenses',
  recurring: 'recurring',
  category: 'categories',
  goal: 'goals',
  setting: 'settings',
}

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return { ...action.data, ready: true }
    case 'upsert': {
      const col = COLLECTION_OF[action.kind]
      const items = state[col]
      const i = items.findIndex((x) => x.id === action.record.id)
      const next = i >= 0
        ? items.map((x, j) => (j === i ? action.record : x))
        : [...items, action.record]
      return { ...state, [col]: next }
    }
    case 'upsertMany': {
      const col = COLLECTION_OF[action.kind]
      const byId = new Map(state[col].map((x) => [x.id, x]))
      for (const r of action.records) byId.set(r.id, r)
      return { ...state, [col]: [...byId.values()] }
    }
    case 'remove': {
      const col = COLLECTION_OF[action.kind]
      return { ...state, [col]: state[col].filter((x) => x.id !== action.id) }
    }
    case 'removeMany': {
      const col = COLLECTION_OF[action.kind]
      const ids = new Set(action.ids)
      return { ...state, [col]: state[col].filter((x) => !ids.has(x.id)) }
    }
    case 'replaceAll':
      return { ...action.data, ready: true }
    default:
      return state
  }
}

const EMPTY = {
  expenses: [], recurring: [], categories: [], goals: [], settings: [],
  ready: false,
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, EMPTY)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let data
      try {
        data = await db.loadAll()
      } catch (err) {
        console.error('Failed to load data from Supabase', err)
        if (!cancelled) {
          setError(err)
          dispatch({ type: 'hydrate', data: { expenses: [], recurring: [], categories: [], goals: [], settings: [] } })
        }
        return
      }

      // First run: seed default categories only, no example data.
      if (data.categories.length === 0) {
        await db.putMany('categories', DEFAULT_CATEGORIES).catch((err) =>
          console.error('Category init failed', err),
        )
        data = { ...data, categories: DEFAULT_CATEGORIES }
      } else {
        // Palette migration: move default categories the user never
        // recolored onto the current default palette.
        const updates = []
        for (const def of DEFAULT_CATEGORIES) {
          const stored = data.categories.find((c) => c.id === def.id)
          if (stored && stored.color !== def.color && LEGACY_DEFAULT_COLORS.has(stored.color)) {
            updates.push({ ...stored, color: def.color })
          }
        }
        if (updates.length > 0) {
          data.categories = data.categories.map(
            (c) => updates.find((u) => u.id === c.id) ?? c,
          )
          await db.putMany('categories', updates).catch((err) => console.error('Palette migration failed', err))
        }
      }

      // One-time cleanup: silently remove example data written by previous app versions.
      const alreadyCleaned = data.settings.find((s) => s.id === 'seedCleanedAt')
      if (!alreadyCleaned) {
        const seedExpenseIds = data.expenses.filter((e) => e.seed).map((e) => e.id)
        const seedRecurringIds = data.recurring.filter((r) => r.seed).map((r) => r.id)
        if (seedExpenseIds.length > 0) {
          await db.removeMany('expenses', seedExpenseIds).catch((err) =>
            console.error('Seed cleanup (expenses) failed', err),
          )
          data = { ...data, expenses: data.expenses.filter((e) => !e.seed) }
        }
        if (seedRecurringIds.length > 0) {
          await db.removeMany('recurring', seedRecurringIds).catch((err) =>
            console.error('Seed cleanup (recurring) failed', err),
          )
          data = { ...data, recurring: data.recurring.filter((r) => !r.seed) }
        }
        const cleanedSetting = { id: 'seedCleanedAt', value: new Date().toISOString() }
        await db.put('settings', cleanedSetting).catch(() => {})
        data = {
          ...data,
          settings: [...data.settings.filter((s) => s.id !== 'seedCleanedAt'), cleanedSetting],
        }
      }

      if (!cancelled) dispatch({ type: 'hydrate', data })
    })()
    return () => { cancelled = true }
  }, [])

  // Write-through actions: state first (snappy UI), then storage.
  const actions = {
    upsert(kind, record) {
      dispatch({ type: 'upsert', kind, record })
      db.put(COLLECTION_OF[kind], record).catch((err) => {
        console.error(`[store] upsert ${kind} ${record.id} failed`, err)
        setError(err)
      })
    },
    upsertMany(kind, records) {
      dispatch({ type: 'upsertMany', kind, records })
      db.putMany(COLLECTION_OF[kind], records).catch((err) => {
        console.error(`[store] upsertMany ${kind} (${records.length}) failed`, err)
        setError(err)
      })
    },
    remove(kind, id) {
      dispatch({ type: 'remove', kind, id })
      db.remove(COLLECTION_OF[kind], id).catch((err) => {
        console.error(`[store] remove ${kind} ${id} failed`, err)
        setError(err)
      })
    },
    removeMany(kind, ids) {
      dispatch({ type: 'removeMany', kind, ids })
      db.removeMany(COLLECTION_OF[kind], ids).catch((err) => {
        console.error(`[store] removeMany ${kind} [${ids.join(',')}] failed`, err)
        setError(err)
      })
    },
    /** Restore from a JSON backup: replaces everything. */
    async restoreAll(data) {
      await db.replaceAll(data)
      dispatch({ type: 'replaceAll', data })
    },
  }

  return (
    <StoreContext.Provider value={{ state, actions, error }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export function useSetting(id, fallbackValue = null) {
  const { state, actions } = useStore()
  const record = state.settings.find((s) => s.id === id)
  const set = (value) => actions.upsert('setting', { id, value })
  return [record ? record.value : fallbackValue, set]
}

export function newId() {
  return crypto.randomUUID()
}
