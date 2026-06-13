import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import * as db from '../db/database.js'
import { buildSeedData, DEFAULT_CATEGORIES, LEGACY_DEFAULT_COLORS } from './seed.js'

/**
 * Single source of truth. The reducer holds the full dataset in memory;
 * every mutation both updates state AND writes through to IndexedDB.
 *
 * Collections: expenses, recurring, categories, goals, settings.
 * All views derive from this via hooks — no component owns data.
 */

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

  // Rehydrate on boot; seed example data on very first run.
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

      const isFirstRun = data.categories.length === 0
      if (isFirstRun) {
        const seedData = buildSeedData()
        try {
          await db.replaceAll(seedData)
        } catch (err) {
          console.error('Seeding failed, continuing with empty data', err)
        }
        data = seedData
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

      if (!cancelled) dispatch({ type: 'hydrate', data })
    })()
    return () => { cancelled = true }
  }, [])

  // Write-through actions: state first (snappy UI), then storage.
  const actions = {
    upsert(kind, record) {
      dispatch({ type: 'upsert', kind, record })
      db.put(COLLECTION_OF[kind], record).catch(setError)
    },
    upsertMany(kind, records) {
      dispatch({ type: 'upsertMany', kind, records })
      db.putMany(COLLECTION_OF[kind], records).catch(setError)
    },
    remove(kind, id) {
      dispatch({ type: 'remove', kind, id })
      db.remove(COLLECTION_OF[kind], id).catch(setError)
    },
    removeMany(kind, ids) {
      dispatch({ type: 'removeMany', kind, ids })
      db.removeMany(COLLECTION_OF[kind], ids).catch(setError)
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
