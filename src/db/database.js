import { supabase } from './supabase.js'

export const STORE_NAMES = ['expenses', 'recurring', 'categories', 'goals', 'settings']

async function getUserId() {
  // getSession() reads from localStorage — no network round-trip.
  // The JWT is sent automatically on every Supabase query; RLS enforces security server-side.
  // Using getUser() (server-validated) caused transient failures that silently swallowed deletes/edits.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not authenticated')
  return session.user.id
}

// Namespace the Supabase row PK so two users with the same app-level record id
// (e.g. 'cat-rent', 'theme') never collide on the shared table primary key.
const rowId = (userId, recordId) => `${userId}/${recordId}`

export async function loadAll() {
  const results = {}
  await Promise.all(
    STORE_NAMES.map(async (name) => {
      const { data, error } = await supabase.from(name).select('data')
      if (error) throw error
      results[name] = (data ?? []).map((row) => row.data)
    }),
  )
  return results
}

export async function put(storeName, record) {
  const user_id = await getUserId()
  const { error } = await supabase
    .from(storeName)
    .upsert({ id: rowId(user_id, record.id), user_id, data: record, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function putMany(storeName, records) {
  if (!records.length) return
  const user_id = await getUserId()
  const rows = records.map((r) => ({
    id: rowId(user_id, r.id), user_id, data: r, updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from(storeName).upsert(rows)
  if (error) throw error
}

export async function remove(storeName, id) {
  const user_id = await getUserId()
  const { error } = await supabase.from(storeName).delete().eq('id', rowId(user_id, id))
  if (error) throw error
}

export async function removeMany(storeName, ids) {
  if (!ids.length) return
  const user_id = await getUserId()
  const { error } = await supabase
    .from(storeName)
    .delete()
    .in('id', ids.map((id) => rowId(user_id, id)))
  if (error) throw error
}

export async function replaceAll(data) {
  const user_id = await getUserId()
  for (const name of STORE_NAMES) {
    const { error: delErr } = await supabase.from(name).delete().eq('user_id', user_id)
    if (delErr) throw delErr
    const records = data[name] ?? []
    if (records.length > 0) {
      const rows = records.map((r) => ({
        id: rowId(user_id, r.id), user_id, data: r, updated_at: new Date().toISOString(),
      }))
      const { error: insErr } = await supabase.from(name).insert(rows)
      if (insErr) throw insErr
    }
  }
}

export function isUsingFallback() {
  return false
}
