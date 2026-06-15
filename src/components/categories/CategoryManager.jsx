import { useState } from 'react'
import { useStore, newId } from '../../store/StoreProvider.jsx'
import { sanitizeText, validateCategory } from '../../utils/validate.js'
import { Sheet, Field, inputClass, PrimaryButton, GhostButton } from '../ui/Sheet.jsx'

// Tonal swatches in the app's data-viz family: greens first, then neutrals.
const SWATCHES = [
  '#0e3d24', '#14532d', '#178a4c', '#3fa56f', '#73bd94', '#a8d6bc',
  '#5d6b4a', '#8a8576', '#b5b1a4', '#3b3a36',
]

/** List + add/rename/recolor categories. Lives inside the settings panel. */
export function CategoryManager() {
  const { state } = useStore()
  const [editing, setEditing] = useState(null) // category object or 'new'

  return (
    <>
      <ul className="divide-y divide-line/70 dark:divide-night-line/70">
        {state.categories.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => setEditing(c)}
              className="group flex w-full items-center gap-3 py-2.5 text-left"
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="flex-1 text-sm transition-colors group-hover:text-accent-deep dark:group-hover:text-accent-bright">
                {c.name}
              </span>
              <span className="text-xs text-ink-faint dark:text-snow-faint">edit</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => setEditing('new')}
        className="mt-3 w-full rounded-full border border-dashed border-line py-2.5 text-sm
          text-ink-soft transition-colors hover:border-accent hover:text-accent-deep
          dark:border-night-line dark:text-snow-soft dark:hover:border-accent dark:hover:text-accent-bright"
      >
        + New category
      </button>

      {editing && (
        <CategorySheet
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function CategorySheet({ category, onClose }) {
  const { state, actions } = useStore()
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? SWATCHES[2])

  const inUse = category && state.expenses.some((e) => e.categoryId === category.id)

  const save = () => {
    const cleanName = sanitizeText(name, 50)
    if (!cleanName || validateCategory({ name: cleanName, color })) return
    actions.upsert('category', {
      id: category?.id ?? newId(),
      name: cleanName,
      color,
      icon: category?.icon ?? 'dots',
    })
    onClose()
  }

  const remove = () => {
    if (inUse) return
    if (!window.confirm(`Delete category “${category.name}”?`)) return
    actions.remove('category', category.id)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={category ? 'Edit category' : 'New category'}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <input className={inputClass} value={name} autoFocus placeholder="e.g. Pets"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>

        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setColor(s)}
                aria-label={`Color ${s}`}
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110
                  ${color === s ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper-raised dark:ring-snow dark:ring-offset-night-raised' : ''}`}
                style={{ background: s }}
              />
            ))}
            <label className="grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line dark:border-night-line"
              title="Custom color">
              <input type="color" className="h-10 w-10 cursor-pointer opacity-0" value={color}
                onChange={(e) => setColor(e.target.value)} />
            </label>
          </div>
        </Field>

        <div className="mt-2 flex flex-col gap-2">
          <PrimaryButton onClick={save} disabled={!name.trim()}>
            {category ? 'Save changes' : 'Create category'}
          </PrimaryButton>
          {category && (
            <GhostButton danger onClick={remove} disabled={inUse}
              title={inUse ? 'Has expenses — reassign them first' : undefined}>
              {inUse ? 'In use — cannot delete' : 'Delete category'}
            </GhostButton>
          )}
        </div>
      </div>
    </Sheet>
  )
}
