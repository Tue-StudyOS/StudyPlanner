import { useLayoutEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { TEST_ROUTES } from '../../routes'
import { useTheme } from '../../theme'
import { useTranslation } from '../../i18n'
import { MoonIcon, SunIcon } from '../../layout/components/icons'
import { getTestParentPath, isTestRoot } from '../utils/testNavigation'

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TestLayout() {
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const atRoot = isTestRoot(location.pathname)
  const parentPath = getTestParentPath(location.pathname)

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-sm text-fg font-sans">
      <header
        className="sticky top-0 z-[70] flex shrink-0 items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur sm:px-6"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(3.25rem + env(safe-area-inset-top, 0px))' }}
      >
        {atRoot ? (
          <Link to={TEST_ROUTES.root} className="truncate font-serif text-base font-semibold text-fg">
            StudyPlanner
          </Link>
        ) : (
          <Link
            to={parentPath}
            className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <BackArrowIcon />
            <span className="truncate">{t('common.back')}</span>
          </Link>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg-muted transition-colors hover:text-fg"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
