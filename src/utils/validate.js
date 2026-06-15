const MAX_AMOUNT_CENTS = 99_999_999 // €999,999.99
const MAX_NOTE_LENGTH = 500

export function sanitizeText(s, maxLength = MAX_NOTE_LENGTH) {
  if (typeof s !== 'string') return ''
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, maxLength)
}

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

export function validateCategory({ name, color }) {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) return 'Name is required.'
  if (trimmed.length > 50) return 'Name must be 50 characters or fewer.'
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return 'Invalid color.'
  return null
}
