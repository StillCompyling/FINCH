import { useState, useEffect } from 'react'
import { useStore } from './store/StoreProvider.jsx'
import { useMonthData, useEarliestMonth } from './hooks/useMonthData.js'
import { currentMonthKey, monthLabel, monthShortLabel, addMonths } from './utils/dates.js'
import { formatCents } from './utils/money.js'
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

export default function App() {
  const { state } = useStore()
  const [view, setView] = useState('overview') // overview | trends | subscriptions
  const [month, setMonth] = useState(currentMonthKey())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [expenseSheet, setExpenseSheet] = useState(null) // null | {expense?}
  const earliestMonth = useEarliestMonth()

  // Hold the boot screen for a minimum beat so the power-on reads as intentional.
  const [bootDone, setBootDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 1500)
    return () => clearTimeout(t)
  }, [])

  if (!state.ready || !bootDone) return <BootScreen />

  return (
    
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-28 sm:px-8">
      <Header onOpenSettings={() => setSettingsOpen(true)} />

      {/* View switcher — Poolsuite tab strip with pixel icons */}
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
          <MonthView key={month} monthKey={month} onEdit={(e) => setExpenseSheet({ expense: e })} />
        </>
      )}
      {view === 'trends' && (
        <div className="pt-4">
          <MultiMonthView />
        </div>
      )}
      {view === 'subscriptions' && (
        <div className="pt-4">
          <RecurringView onEditExpense={(e) => setExpenseSheet({ expense: e })} />
        </div>
      )}

      {/* Primary action: always one tap away */}
      <button
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-30 flex h-14 items-center
          gap-2 rounded-[8px] border-[1.5px] border-ink bg-pink pl-5 pr-6 text-ink shadow-[3px_3px_0_0_var(--color-ink)]
          transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:right-10"
        onClick={() => setExpenseSheet({})}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="text-sm font-bold uppercase tracking-wide">Add</span>
      </button>

      {expenseSheet && (
        <ExpenseSheet
          open
          expense={expenseSheet.expense ?? null}
          onClose={() => setExpenseSheet(null)}
        />
      )}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
      {/* Headline total — Poolsuite LCD readout */}
      <LcdTotal
        span="md:col-span-3"
        monthKey={monthKey}
        totalCents={totalCents}
        prevTotalCents={previous.totalCents}
      />

      <Card span="md:col-span-3">
        <CardLabel>Category breakdown</CardLabel>
        <DonutCard byCategory={byCategory} totalCents={totalCents} />
      </Card>

      <Card span="md:col-span-4">
        <CardLabel>Spending over time</CardLabel>
        <TrendCard
          cumulative={cumulative}
          previousCumulative={previous.cumulative}
          monthShort={monthShortLabel(monthKey)}
          prevMonthShort={monthShortLabel(prevKey)}
        />
      </Card>

      <Card span="md:col-span-2">
        <CardLabel>Goals</CardLabel>
        <GoalsCard monthKey={monthKey} />
      </Card>


      <Card span="md:col-span-6">
        <CardLabel>This month&rsquo;s entries</CardLabel>
        <ExpenseList entries={visibleEntries} onEdit={onEdit} />
      </Card>
    </main>
  )
}

/** Chunky pixel-art glyphs for the section tabs. currentColor follows the tab. */
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
  // overview — 2x2 window
  return (
    <svg viewBox="0 0 9 9" {...common}>
      <rect x="0" y="0" width="4" height="4" />
      <rect x="5" y="0" width="4" height="4" />
      <rect x="0" y="5" width="4" height="4" />
      <rect x="5" y="5" width="4" height="4" />
    </svg>
  )
}
