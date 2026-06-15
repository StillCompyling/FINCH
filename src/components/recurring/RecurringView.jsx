import { useMemo, useState } from 'react'
import { useStore, newId } from '../../store/StoreProvider.jsx'
import { sanitizeText, validateRecurring } from '../../utils/validate.js'
import { useCategoryIndex } from '../../hooks/useMonthData.js'
import { annualizedCents, projectionLadder, CYCLES } from '../../utils/recurrence.js'
import { formatCents, formatCentsWhole, parseToCents } from '../../utils/money.js'
import { todayISO } from '../../utils/dates.js'
import { Card, CardLabel } from '../layout/Card.jsx'
import { Sheet, Field, inputClass, PrimaryButton, GhostButton } from '../ui/Sheet.jsx'
import { ExpenseList } from '../expenses/ExpenseList.jsx'

const CYCLE_LABEL = { weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year' }

/** Subscriptions section: combined cost headline + per-item ladders. */
export function RecurringView({ onEditExpense }) {
  const { state, actions } = useStore()
  const [editing, setEditing] = useState(null) // recurring | 'new'
  const [showArchived, setShowArchived] = useState(false)

  const active = state.recurring.filter((r) => r.status === 'active')
  const paused = state.recurring.filter((r) => r.status === 'paused')
  const archived = state.recurring.filter((r) => r.status === 'archived')

  const combined = useMemo(() => {
    const annual = active.reduce((acc, r) => acc + annualizedCents(r.amountCents, r.cycle), 0)
    const monthly = Math.round(annual / 12)
    return { annual, monthly, ladder: [1, 2, 5, 10].map((years) => ({ years, totalCents: annual * years })) }
  }, [state.recurring]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="animate-rise grid grid-cols-1 gap-4 md:grid-cols-6">
      {/* Headline: what subscriptions really cost */}
      <Card span="md:col-span-6">
        <CardLabel>All subscriptions — true cost</CardLabel>
        {active.length === 0 ? (
          <p className="py-6 text-sm text-ink-faint dark:text-snow-faint">
            No active subscriptions. Add Netflix, the gym, that app you forgot about…
          </p>
        ) : (
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-10">
            <div className="shrink-0">
              <p className="figure-serif text-5xl">{formatCentsWhole(combined.monthly)}</p>
              <p className="mt-1 text-sm text-ink-soft dark:text-snow-soft">
                per month · {active.length} active subscription{active.length !== 1 && 's'}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint dark:text-snow-faint">
                {formatCentsWhole(combined.annual)} per year
              </p>
            </div>
            <CostLadder ladder={combined.ladder} large />
          </div>
        )}
      </Card>


      {/* Per-subscription cards */}
      {[...active, ...paused].map((r) => (
        <SubscriptionCard key={r.id} sub={r} onEdit={() => setEditing(r)}
          onToggle={() => actions.upsert('recurring', { ...r, status: r.status === 'active' ? 'paused' : 'active' })} />
      ))}

      <Card span="md:col-span-6" className="border-dashed bg-transparent shadow-none dark:bg-transparent">
        <button
          onClick={() => setEditing('new')}
          className="w-full py-2 text-center text-sm font-medium text-accent-deep transition-colors
            hover:text-accent dark:text-accent-bright"
        >
          + Add recurring expense
        </button>
      </Card>

      <OneOffSubscriptionCharges onEdit={onEditExpense} />

      {archived.length > 0 && (
        <Card span="md:col-span-6">
          <button onClick={() => setShowArchived(!showArchived)} className="w-full text-left">
            <CardLabel className="mb-0">
              Archived ({archived.length}) {showArchived ? '▾' : '▸'}
            </CardLabel>
          </button>
          {showArchived && (
            <ul className="mt-4 divide-y divide-line/70 dark:divide-night-line/70">
              {archived.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5 text-sm text-ink-faint dark:text-snow-faint">
                  <span>{r.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="tnum">{formatCents(r.amountCents)}/{CYCLE_LABEL[r.cycle]}</span>
                    <button
                      onClick={() => actions.upsert('recurring', { ...r, status: 'paused' })}
                      className="text-xs font-medium text-accent-deep hover:underline dark:text-accent-bright"
                    >
                      Restore
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {editing && (
        <RecurringSheet sub={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </main>
  )
}

/**
 * One-off expenses categorized as Subscriptions are routed here from the
 * Overview list — same edit/select/delete behavior, just a different home.
 */
function OneOffSubscriptionCharges({ onEdit }) {
  const { state } = useStore()
  const charges = state.expenses
    .filter((e) => e.categoryId === 'cat-subscriptions')
    .sort((a, b) => b.date.localeCompare(a.date))

  if (charges.length === 0) return null

  return (
    <Card span="md:col-span-6">
      <CardLabel>One-off subscription charges</CardLabel>
      <p className="-mt-2 mb-3 text-xs text-ink-faint dark:text-snow-faint">
        Expenses filed under the Subscriptions category. They count toward each
        month&rsquo;s totals; manage them here.
      </p>
      <ExpenseList entries={charges} onEdit={onEdit} />
    </Card>
  )
}

/** Horizontal cost ladder: 1/2/5/10-year bars, normalized to the 10y total. */
function CostLadder({ ladder, large = false }) {
  const max = ladder[ladder.length - 1].totalCents
  return (
    <div className={`w-full space-y-1.5 ${large ? 'max-w-xl' : ''}`}>
      {ladder.map((step, i) => (
        <div key={step.years} className="flex items-center gap-3">
          <span className="tnum w-8 shrink-0 text-right text-xs text-ink-faint dark:text-snow-faint">
            {step.years}y
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-line/60 dark:bg-night-line/60">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
              style={{
                width: `${(step.totalCents / max) * 100}%`,
                opacity: 0.45 + i * 0.18,
              }}
            />
          </div>
          <span className={`tnum shrink-0 text-right text-xs font-medium ${large ? 'w-20' : 'w-16'}`}>
            {formatCentsWhole(step.totalCents)}
          </span>
        </div>
      ))}
    </div>
  )
}

function SubscriptionCard({ sub, onEdit, onToggle }) {
  const categoryOf = useCategoryIndex()
  const cat = sub.categoryId ? categoryOf(sub.categoryId) : null
  const paused = sub.status === 'paused'

  return (
    <Card span="md:col-span-3" className={paused ? 'opacity-60' : ''}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <button onClick={onEdit} className="group min-w-0 text-left">
          <p className="truncate text-base font-medium transition-colors group-hover:text-accent-deep dark:group-hover:text-accent-bright">
            {sub.name}
          </p>
          <p className="tnum mt-0.5 text-sm text-ink-soft dark:text-snow-soft">
            {formatCents(sub.amountCents)} / {CYCLE_LABEL[sub.cycle]}
            {cat && <span className="text-ink-faint dark:text-snow-faint"> · {cat.name}</span>}
            {paused && <span className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-warn">paused</span>}
          </p>
        </button>
        <button
          onClick={onToggle}
          title={paused ? 'Resume' : 'Pause'}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors
            ${paused ? 'bg-line dark:bg-night-line' : 'bg-accent'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]
            ${paused ? 'left-0.5' : 'left-[22px]'}`} />
        </button>
      </div>
      <CostLadder ladder={projectionLadder(sub.amountCents, sub.cycle)} />
    </Card>
  )
}

function RecurringSheet({ sub, onClose }) {
  const { state, actions } = useStore()
  const [name, setName] = useState(sub?.name ?? '')
  const [amount, setAmount] = useState(sub ? (sub.amountCents / 100).toFixed(2).replace('.', ',') : '')
  const [cycle, setCycle] = useState(sub?.cycle ?? 'monthly')
  const [startDate, setStartDate] = useState(sub?.startDate ?? todayISO())
  const [categoryId, setCategoryId] = useState(sub?.categoryId ?? 'cat-subscriptions')

  const cents = parseToCents(amount)
  const valid = name.trim() && cents !== null && cents > 0 && startDate

  const save = () => {
    const cleanName = sanitizeText(name, 100)
    if (!valid || validateRecurring({ amountCents: cents, name: cleanName, startDate })) return
    actions.upsert('recurring', {
      id: sub?.id ?? newId(),
      name: cleanName,
      amountCents: cents,
      cycle,
      startDate,
      categoryId,
      status: sub?.status ?? 'active',
    })
    onClose()
  }

  const archive = () => {
    actions.upsert('recurring', { ...sub, status: 'archived' })
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={sub ? 'Edit subscription' : 'New recurring expense'}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <input className={inputClass} value={name} autoFocus placeholder="e.g. Netflix"
            onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (€)">
            <input className={`${inputClass} figure-serif text-xl`} inputMode="decimal" placeholder="0,00"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Billing cycle">
            <select className={inputClass} value={cycle} onChange={(e) => setCycle(e.target.value)}>
              {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="First billed">
            <input type="date" className={inputClass} value={startDate}
              onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Category">
            <select className={inputClass} value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value)}>
              {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        {cents > 0 && (
          <div className="rounded-xl bg-accent-wash p-4 dark:bg-accent-wash-dark">
            <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-accent-deep dark:text-accent-bright">
              Long-term cost
            </p>
            <CostLadder ladder={projectionLadder(cents, cycle)} />
          </div>
        )}

        <div className="mt-1 flex flex-col gap-2">
          <PrimaryButton onClick={save} disabled={!valid}>
            {sub ? 'Save changes' : 'Add subscription'}
          </PrimaryButton>
          {sub && (
            <GhostButton onClick={archive}>
              Archive (cancelled — keeps history)
            </GhostButton>
          )}
        </div>
      </div>
    </Sheet>
  )
}
