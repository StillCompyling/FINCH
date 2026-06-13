import { useState } from 'react'
import { useStore, newId } from '../../store/StoreProvider.jsx'
import { useCategorySuggester } from '../../hooks/useCategorySuggester.js'
import { parseToCents, formatCents } from '../../utils/money.js'
import { todayISO } from '../../utils/dates.js'
import { validateExpense, sanitizeText } from '../../utils/validate.js'
import { Sheet, Field, inputClass, PrimaryButton, GhostButton } from '../ui/Sheet.jsx'

/**
 * Add/edit form for a single expense. Pass `expense` to edit, null to add.
 */
export function ExpenseSheet({ open, onClose, expense }) {
  const { state, actions } = useStore()
  const { suggest, lastCategoryId } = useCategorySuggester()
  const editing = Boolean(expense)

  const [amount, setAmount] = useState(expense ? (expense.amountCents / 100).toFixed(2).replace('.', ',') : '')
  // New expenses default to the last-used category; suggestions refine it as
  // the note is typed, until the user picks one themselves.
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? lastCategoryId ?? state.categories[0]?.id,
  )
  const [categoryTouched, setCategoryTouched] = useState(editing)
  const [suggested, setSuggested] = useState(false)
  const [date, setDate] = useState(expense?.date ?? todayISO())
  const [note, setNote] = useState(expense?.note ?? '')

  const chooseCategory = (id) => {
    setCategoryId(id)
    setCategoryTouched(true)
    setSuggested(false)
  }

  // As the note changes, auto-suggest a category — but never override a
  // choice the user has already made by hand.
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

  const save = () => {
    if (validationError) { setSaveError(validationError); return }
    actions.upsert('expense', {
      id: expense?.id ?? newId(),
      amountCents: cents,
      categoryId,
      date,
      note: sanitizeText(note),
    })
    onClose()
  }

  const remove = () => {
    if (!window.confirm(`Delete this expense (${formatCents(expense.amountCents)})?`)) return
    actions.remove('expense', expense.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit expense' : 'Add expense'}>
      <div className="flex flex-col gap-4">
        <Field label="Amount (€)">
          <input
            className={`${inputClass} figure-serif text-2xl`}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
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
    </Sheet>
  )
}
