import { useState, useRef, useMemo } from 'react'
import { useStore, newId } from '../../store/StoreProvider.jsx'
import { useCategorySuggester } from '../../hooks/useCategorySuggester.js'
import { parseToCents, formatCents } from '../../utils/money.js'
import { todayISO } from '../../utils/dates.js'
import { validateExpense, sanitizeText } from '../../utils/validate.js'
import { Sheet, Field, inputClass, PrimaryButton, GhostButton } from '../ui/Sheet.jsx'

/**
 * Add/edit form for a single expense. Pass `expense` to edit, null to add.
 * Pass `prefill` + `thumbSrc` when opening from a receipt scan.
 */
export function ExpenseSheet({ open, onClose, expense, prefill, thumbSrc, onSavedFromScan }) {
  const { state, actions } = useStore()
  const { suggest, lastCategoryId } = useCategorySuggester()
  const editing = Boolean(expense)
  const fromScan = Boolean(prefill)
  const savedRef = useRef(false)

  // Match scan's suggested_category string to a category id
  const scanCategoryId = useMemo(() => {
    if (!prefill?.suggested_category) return null
    const needle = prefill.suggested_category.toLowerCase()
    const exact = state.categories.find((c) => c.name.toLowerCase() === needle)
    if (exact) return exact.id
    const partial = state.categories.find(
      (c) => needle.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(needle),
    )
    return partial?.id ?? null
  }, [prefill, state.categories])

  const [amount, setAmount] = useState(() => {
    if (expense) return (expense.amountCents / 100).toFixed(2).replace('.', ',')
    if (prefill?.total_amount_cents) return (prefill.total_amount_cents / 100).toFixed(2).replace('.', ',')
    return ''
  })
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? scanCategoryId ?? lastCategoryId ?? state.categories[0]?.id,
  )
  const [categoryTouched, setCategoryTouched] = useState(editing || Boolean(scanCategoryId))
  const [suggested, setSuggested] = useState(false)
  const [date, setDate] = useState(expense?.date ?? prefill?.date ?? todayISO())
  const [note, setNote] = useState(expense?.note ?? prefill?.note ?? '')
  const [thumbOpen, setThumbOpen] = useState(false)

  const chooseCategory = (id) => {
    setCategoryId(id)
    setCategoryTouched(true)
    setSuggested(false)
  }

  const onNoteChange = (value) => {
    setNote(value)
    if (categoryTouched) return
    const guess = suggest(value)
    if (guess) {
      setCategoryId(guess)
      setSuggested(true)
    } else {
      setCategoryId(lastCategoryId ?? state.categories[0]?.id)
      setSuggested(false)
    }
  }

  const cents = parseToCents(amount)
  const validCategoryIds = new Set(state.categories.map((c) => c.id))
  const validationError = validateExpense({ amountCents: cents, date, note, categoryId, validCategoryIds })
  const valid = cents !== null && cents > 0 && Boolean(date) && Boolean(categoryId) && !validationError

  const [saveError, setSaveError] = useState(null)

  const handleClose = () => {
    if (fromScan && !savedRef.current) {
      if (!window.confirm('Discard scanned receipt?')) return
    }
    onClose()
  }

  const save = () => {
    if (validationError) { setSaveError(validationError); return }
    actions.upsert('expense', {
      id: expense?.id ?? newId(),
      amountCents: cents,
      categoryId,
      date,
      note: sanitizeText(note),
    })
    savedRef.current = true
    if (fromScan && onSavedFromScan) {
      onSavedFromScan()
    } else {
      onClose()
    }
  }

  const remove = () => {
    if (!window.confirm(`Delete this expense (${formatCents(expense.amountCents)})?`)) return
    actions.remove('expense', expense.id)
    onClose()
  }

  const amountIsZero = fromScan && prefill.total_amount_cents === 0

  return (
    <Sheet open={open} onClose={handleClose} title={editing ? 'Edit expense' : 'Add expense'}>
      <div className="flex flex-col gap-4">

        {/* Scan confidence warning */}
        {fromScan && prefill.confidence === 'low' && (
          <div className="rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            Double-check these values — the scan wasn&rsquo;t confident.
          </div>
        )}

        {/* Receipt thumbnail (tappable to view full size) */}
        {thumbSrc && (
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setThumbOpen(true)}
              className="shrink-0 overflow-hidden rounded-[6px] border-[1.5px] border-ink shadow-card"
              title="View receipt"
            >
              <img src={thumbSrc} alt="Receipt" className="h-14 w-14 object-cover" />
            </button>
            <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-soft">
              Scanned receipt — tap to view full size
            </p>
          </div>
        )}

        <Field label={
          <span className="flex items-center gap-1.5">
            Amount (€)
            {fromScan && (
              <svg viewBox="0 0 24 24" className="h-3 w-3 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
          </span>
        }>
          <input
            className={`${inputClass} figure-serif text-2xl ${amountIsZero ? 'border-amber-400 focus:shadow-[2px_2px_0_0_#f59e0b]' : ''}`}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          {amountIsZero && (
            <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400">
              Please verify the total
            </p>
          )}
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-1.5">
            {state.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => chooseCategory(c.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors
                  ${categoryId === c.id
                    ? 'border-transparent bg-ink text-paper dark:bg-snow dark:text-night'
                    : 'border-line text-ink-soft hover:border-accent dark:border-night-line dark:text-snow-soft dark:hover:border-accent'}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
          {suggested && !categoryTouched && (
            <p className="mt-2 text-xs text-accent-deep dark:text-accent-bright">
              Suggested from past entries — tap any to change.
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className={inputClass} value={date} max={todayISO()}
              onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note (optional)">
            <input className={inputClass} placeholder="e.g. groceries" value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()} />
          </Field>
        </div>

        {saveError && (
          <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {saveError}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-2">
          <PrimaryButton onClick={save} disabled={!valid}>
            {editing ? 'Save changes' : `Add ${cents > 0 ? formatCents(cents) : 'expense'}`}
          </PrimaryButton>
          {editing && <GhostButton danger onClick={remove}>Delete expense</GhostButton>}
        </div>
      </div>

      {/* Full-size receipt lightbox */}
      {thumbOpen && thumbSrc && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-4"
          onClick={() => setThumbOpen(false)}
        >
          <img
            src={thumbSrc}
            alt="Receipt full size"
            className="max-h-full max-w-full rounded-[8px] object-contain shadow-card"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Sheet>
  )
}
