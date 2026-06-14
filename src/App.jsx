import { useState, useEffect, useRef } from 'react'
import { useAuth } from './auth/AuthProvider.jsx'
import { SignIn } from './auth/SignIn.jsx'
import { StoreProvider, useStore } from './store/StoreProvider.jsx'
import { useMonthData, useEarliestMonth } from './hooks/useMonthData.js'
import { currentMonthKey, monthShortLabel, addMonths } from './utils/dates.js'
import { formatCents } from './utils/money.js'
import { ReceiptScanner } from './components/expenses/ReceiptScanner.jsx'
import { Header } from './components/layout/Header.jsx'
import { MonthTabs } from './components/layout/MonthTabs.jsx'
import { Card, CardLabel } from './components/layout/Card.jsx'
import { SettingsPanel } from './components/settings/SettingsPanel.jsx'
import { ExpenseSheet } from './components/expenses/ExpenseSheet.jsx'
import { ExpenseList } from './components/expenses/ExpenseList.jsx'
import { DonutCard } from './components/charts/DonutCard.jsx'
import { TrendCard } from './components/charts/TrendCard.jsx'
import { GoalsCard } from './components/goals/GoalsCard.jsx'
import { RecurringView } from './components/recurring/RecurringView.jsx'
import { MultiMonthView } from './components/trends/MultiMonthView.jsx'
import { LcdTotal } from './components/ui/LcdTotal.jsx'
import { BootScreen } from './components/ui/BootScreen.jsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.jsx'

export default function App() {
  const { session, authError } = useAuth()

  if (session === undefined) return <BootScreen />
  if (authError && !session) return <AuthErrorScreen message={authError} />
  if (!session) return <SignIn />

  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  )
}

function useOffline() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return offline
}

function AppInner() {
  const { state } = useStore()
  const [view, setView] = useState('overview') // overview | trends | subscriptions
  const [month, setMonth] = useState(currentMonthKey())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [expenseSheet, setExpenseSheet] = useState(null) // null | {expense?, prefill?, thumbSrc?}
  const [scanAgainChip, setScanAgainChip] = useState(false)
  const scannerRef = useRef(null)
  const scanAgainTimer = useRef(null)
  const earliestMonth = useEarliestMonth()
  const offline = useOffline()

  const [bootDone, setBootDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 1500)
    return () => clearTimeout(t)
  }, [])

  if (!state.ready || !bootDone) return <BootScreen />

  const hasRealExpenses = state.expenses.length > 0

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-28 sm:px-8">
      {offline && (
        <div className="sticky top-0 z-50 -mx-4 bg-ink px-4 py-2 text-center font-mono text-xs text-paper sm:-mx-8 sm:px-8">
          You&rsquo;re offline — changes will sync when you reconnect.
        </div>
      )}
      <Header onOpenSettings={() => setSettingsOpen(true)} />

      <nav className="mt-2 flex gap-1.5" aria-label="Sections">
        {[['overview', 'Overview'], ['trends', 'Trends'], ['subscriptions', 'Subscriptions']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 rounded-[6px] border-[1.5px] border-ink px-2.5 py-1.5 text-[0.7rem] font-bold uppercase
              tracking-tight transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:px-3 sm:text-xs sm:tracking-wide
              ${view === id
                ? 'bg-pink text-ink shadow-card'
                : 'bg-paper-raised text-ink-soft hover:bg-pink-wash'}`}
          >
            <PixelIcon name={id} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {view === 'overview' && (
        <>
          <MonthTabs selected={month} onSelect={setMonth} earliestWithData={earliestMonth} />
          {!hasRealExpenses && <WelcomeCard onAdd={() => setExpenseSheet({})} />}
          <ErrorBoundary label="Overview">
            <MonthView key={month} monthKey={month} onEdit={(e) => setExpenseSheet({ expense: e })} />
          </ErrorBoundary>
        </>
      )}
      {view === 'trends' && (
        <div className="pt-4">
          <ErrorBoundary label="Trends">
            <MultiMonthView />
          </ErrorBoundary>
        </div>
      )}
      {view === 'subscriptions' && (
        <div className="pt-4">
          <ErrorBoundary label="Subscriptions">
            <RecurringView onEditExpense={(e) => setExpenseSheet({ expense: e })} />
          </ErrorBoundary>
        </div>
      )}

      {/* FAB row: camera scan + add expense */}
      <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-30 flex items-center gap-2 sm:right-10">
        <ReceiptScanner
          ref={scannerRef}
          onScan={({ data, thumbSrc }) => {
            setScanAgainChip(false)
            clearTimeout(scanAgainTimer.current)
            setExpenseSheet({ prefill: data, thumbSrc })
          }}
        />
        <button
          className="flex h-14 items-center gap-2 rounded-[8px] border-[1.5px] border-ink bg-pink
            pl-5 pr-6 text-ink shadow-[3px_3px_0_0_var(--color-ink)]
            transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          onClick={() => setExpenseSheet({})}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-sm font-bold uppercase tracking-wide">Add</span>
        </button>
      </div>

      {/* Scan-again chip — appears briefly after saving a scanned expense */}
      {scanAgainChip && (
        <div className="fixed bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+4rem)] left-1/2 z-40 -translate-x-1/2 animate-rise">
          <div className="flex items-center gap-3 rounded-[8px] border-[1.5px] border-ink bg-paper-raised px-4 py-2.5 shadow-card">
            <span className="font-mono text-xs text-ink-soft">✓ Saved</span>
            <button
              className="font-mono text-xs font-bold text-accent underline-offset-2 hover:underline"
              onClick={() => {
                setScanAgainChip(false)
                clearTimeout(scanAgainTimer.current)
                scannerRef.current?.trigger()
              }}
            >
              Scan another →
            </button>
            <button
              onClick={() => { setScanAgainChip(false); clearTimeout(scanAgainTimer.current) }}
              className="text-sm leading-none text-ink-faint hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {expenseSheet && (
        <ExpenseSheet
          open
          expense={expenseSheet.expense ?? null}
          prefill={expenseSheet.prefill}
          thumbSrc={expenseSheet.thumbSrc}
          onClose={() => setExpenseSheet(null)}
          onSavedFromScan={expenseSheet.prefill ? () => {
            setExpenseSheet(null)
            setScanAgainChip(true)
            clearTimeout(scanAgainTimer.current)
            scanAgainTimer.current = setTimeout(() => setScanAgainChip(false), 5000)
          } : undefined}
        />
      )}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function WelcomeCard({ onAdd }) {
  return (
    <div className="mb-4 mt-3 rounded-[8px] border-[1.5px] border-ink bg-white p-5 shadow-card">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-soft">
        Welcome to Finch
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink">
        Track every expense, set spending goals, and see where your money actually goes.
        Start by adding your first expense.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onAdd}
          className="rounded-[6px] border-[1.5px] border-ink bg-pink px-4 py-2 font-mono text-xs
            font-bold uppercase tracking-[0.06em] text-ink shadow-card transition-transform
            active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        >
          + Add expense
        </button>
      </div>
    </div>
  )
}

function AuthErrorScreen({ message }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper px-6 text-center">
      <p className="font-mono text-sm text-ink">{message}</p>
      <button
        onClick={() => { window.location.href = '/' }}
        className="rounded-[6px] border-[1.5px] border-ink bg-pink px-5 py-2.5
          font-mono text-sm font-bold uppercase tracking-[0.06em] text-ink shadow-card
          transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        Try again
      </button>
    </div>
  )
}

function MonthView({ monthKey, onEdit }) {
  const { totalCents, visibleEntries, byCategory, cumulative } = useMonthData(monthKey)
  const prevKey = addMonths(monthKey, -1)
  const previous = useMonthData(prevKey)
  const deltaCents = totalCents - previous.totalCents

  return (
    <main className="animate-rise grid grid-cols-1 gap-4 pt-1 md:grid-cols-6">
      <ErrorBoundary label="Total">
        <LcdTotal
          span="md:col-span-3"
          monthKey={monthKey}
          totalCents={totalCents}
          prevTotalCents={previous.totalCents}
        />
      </ErrorBoundary>

      <Card span="md:col-span-3">
        <CardLabel>Category breakdown</CardLabel>
        <ErrorBoundary label="Donut chart">
          <DonutCard byCategory={byCategory} totalCents={totalCents} />
        </ErrorBoundary>
      </Card>

      <Card span="md:col-span-4">
        <CardLabel>Spending over time</CardLabel>
        <ErrorBoundary label="Trend chart">
          <TrendCard
            cumulative={cumulative}
            previousCumulative={previous.cumulative}
            monthShort={monthShortLabel(monthKey)}
            prevMonthShort={monthShortLabel(prevKey)}
          />
        </ErrorBoundary>
      </Card>

      <Card span="md:col-span-2">
        <CardLabel>Goals</CardLabel>
        <ErrorBoundary label="Goals">
          <GoalsCard monthKey={monthKey} />
        </ErrorBoundary>
      </Card>

      <Card span="md:col-span-6">
        <CardLabel>This month&rsquo;s entries</CardLabel>
        <ErrorBoundary label="Expense list">
          <ExpenseList entries={visibleEntries} onEdit={onEdit} />
        </ErrorBoundary>
      </Card>
    </main>
  )
}

function PixelIcon({ name }) {
  const common = { className: 'h-3 w-3 shrink-0', fill: 'currentColor', shapeRendering: 'crispEdges' }
  if (name === 'trends') {
    return (
      <svg viewBox="0 0 9 9" {...common}>
        <rect x="0" y="6" width="2" height="3" />
        <rect x="3.5" y="3" width="2" height="6" />
        <rect x="7" y="0" width="2" height="9" />
      </svg>
    )
  }
  if (name === 'subscriptions') {
    return (
      <svg viewBox="0 0 9 9" {...common} fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="0.7" y="0.7" width="5" height="5" />
        <rect x="3.3" y="3.3" width="5" height="5" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 9 9" {...common}>
      <rect x="0" y="0" width="4" height="4" />
      <rect x="5" y="0" width="4" height="4" />
      <rect x="0" y="5" width="4" height="4" />
      <rect x="5" y="5" width="4" height="4" />
    </svg>
  )
}
