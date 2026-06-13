const MAX_AMOUNT_CENTS = 99_999_999 // €999,999.99
const MAX_NOTE_LENGTH = 500
const HTML_TAG_RE = /<[^>]*>/g

export function sanitizeText(s) {
  return s.replace(HTML_TAG_RE, '').trim()
}

/**
 * Validates expense fields. Returns an error string or null if valid.
 * Call before saving — this is the last line of defence before Supabase.
 */
export function validateExpense({ amountCents, date, note, categoryId, validCategoryIds }) {
  if (!amountCents || amountCents <= 0) return 'Amount must be greater than zero.'
  if (amountCents > MAX_AMOUNT_CENTS) return 'Amount cannot exceed €999,999.99.'

  if (!date) return 'Date is required.'
  const d = new Date(date)
  if (isNaN(d.getTime())) return 'Invalid date.'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(23, 59, 59, 999)
  if (d > tomorrow) return 'Date cannot be more than one day in the future.'

  if (note && note.length > MAX_NOTE_LENGTH) return `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`

  if (categoryId && validCategoryIds && !validCategoryIds.has(categoryId)) return 'Invalid category.'

  return null
}

export function validateRecurring({ amountCents, name, startDate }) {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) return 'Name is required.'
  if (trimmed.length > 100) return 'Name must be 100 characters or fewer.'
  if (!amountCents || amountCents <= 0) return 'Amount must be greater than zero.'
  if (amountCents > MAX_AMOUNT_CENTS) return 'Amount cannot exceed €999,999.99.'
  if (!startDate) return 'Start date is required.'
  return null
}
