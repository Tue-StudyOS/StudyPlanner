import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MasterCat } from '../../courses'

/** All Informatik categories in display order. */
const ALL_CATEGORIES: readonly MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']

/** Reuses the existing category color tokens from index.css. */
const CAT_COLOR_VAR: Record<MasterCat, string> = {
  TECH: 'var(--color-cat-tech)',
  THEO: 'var(--color-cat-theo)',
  PRAK: 'var(--color-cat-prak)',
  INFO: 'var(--color-cat-info)',
  BASIS: 'var(--color-cat-basis)',
}

const MENU_WIDTH = 132
const MENU_ROW_HEIGHT = 30
const MENU_VERTICAL_PADDING = 8

interface CourseCategoryDropdownProps {
  value: MasterCat
  /** Categories that map to a real regulation area for this course; only these
   *  can be persisted (the backend derives the category from the study area). */
  selectable: MasterCat[]
  onChange: (masterCat: MasterCat) => void
}

interface MenuPosition {
  top: number
  left: number
}

export function CourseCategoryDropdown({ value, selectable, onChange }: CourseCategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  // The menu is portalled to <body> so no `overflow` ancestor (the horizontally
  // scrolling semester row) can clip it. Its position is derived from the
  // trigger's viewport rect and flips above only when it would overflow the
  // bottom — the height comes from the actual row count so the flip never leaves
  // it floating away from the trigger.
  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }

    const menuHeight = ALL_CATEGORIES.length * MENU_ROW_HEIGHT + MENU_VERTICAL_PADDING

    function updatePosition(): void {
      const trigger = triggerRef.current
      if (!trigger) {
        return
      }
      const rect = trigger.getBoundingClientRect()
      const opensUpward = rect.bottom + menuHeight + 8 > window.innerHeight && rect.top - menuHeight - 8 > 0
      const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8)
      setMenuPosition({
        top: opensUpward ? rect.top - menuHeight - 4 : rect.bottom + 4,
        left: Math.max(8, left),
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    function handlePointerDown(event: MouseEvent): void {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Informatik-Kategorie wählen"
        className="flex h-7 items-center gap-1 rounded-md border border-neutral-200 bg-white pl-2 pr-1.5 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        style={{ boxShadow: `inset 3px 0 0 ${CAT_COLOR_VAR[value]}` }}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CAT_COLOR_VAR[value] }} />
        <span className="w-9 text-center text-[10px] font-semibold tracking-wide text-neutral-600 dark:text-neutral-300">
          {value}
        </span>
        <svg width="9" height="6" viewBox="0 0 10 6" aria-hidden="true" className="shrink-0 text-neutral-400">
          <path
            d="M1 1l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && menuPosition
        ? createPortal(
            <ul
              ref={menuRef}
              role="listbox"
              className="fixed z-[100] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
              style={{ top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH }}
            >
              {ALL_CATEGORIES.map((cat) => {
                const isAvailable = selectable.includes(cat)
                return (
                  <li key={cat}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={cat === value}
                      disabled={!isAvailable}
                      title={isAvailable ? undefined : 'Für diesen Kurs nicht durch die Prüfungsordnung zugelassen'}
                      onClick={() => {
                        onChange(cat)
                        setIsOpen(false)
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] font-semibold tracking-wide transition-colors ${
                        isAvailable
                          ? 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800'
                          : 'cursor-not-allowed text-neutral-300 dark:text-neutral-600'
                      } ${cat === value ? 'bg-neutral-50 dark:bg-neutral-800/60' : ''}`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CAT_COLOR_VAR[cat], opacity: isAvailable ? 1 : 0.35 }}
                      />
                      {cat}
                    </button>
                  </li>
                )
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
