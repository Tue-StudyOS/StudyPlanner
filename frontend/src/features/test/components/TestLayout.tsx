import { useLayoutEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TEST_ROUTES } from '../../routes'
import { useTheme } from '../../theme'
import { useTranslation } from '../../i18n'
import { useAuth } from '../../auth'
import { MoonIcon, SunIcon } from '../../layout/components/icons'
import { getTestParentPath, isTestRoot } from '../utils/testNavigation'
import { GptChatBubble } from './GptChatBubble'

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SettingsDropdown({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  function handleLogout(): void {
    logout()
    onClose()
    navigate(TEST_ROUTES.root)
  }

  return (
    <div className="absolute right-0 top-full z-[80] mt-1.5 min-w-[180px] rounded-[10px] border border-border bg-surface shadow-lg">
      {user ? (
        <div className="border-b border-border px-4 py-2.5 text-[12px] font-medium text-fg-muted">
          {user.username}
        </div>
      ) : null}
      <div className="p-1">
        <button
          type="button"
          className="flex w-full items-center rounded-md px-3 py-2 text-left text-[13px] text-fg transition-colors hover:bg-surface-hover"
          onClick={() => {
            navigate(TEST_ROUTES.personal)
            onClose()
          }}
        >
          {t('test.transcript.updateTor')}
        </button>
        {user ? (
          <button
            type="button"
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-[13px] text-danger transition-colors hover:bg-surface-hover"
            onClick={handleLogout}
          >
            {t('auth.logout')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function TestLayout() {
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const atRoot = isTestRoot(location.pathname)
  const parentPath = getTestParentPath(location.pathname)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const gearRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useLayoutEffect(() => {
    if (!settingsOpen) return
    function handleOutside(event: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [settingsOpen])

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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg-muted transition-colors hover:text-fg"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          <div ref={gearRef} className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              aria-label={t('nav.settings')}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg-muted transition-colors hover:text-fg"
            >
              <GearIcon />
            </button>
            {settingsOpen ? <SettingsDropdown onClose={() => setSettingsOpen(false)} /> : null}
          </div>
        </div>
      </header>

      <main key={location.pathname} className="test-zoom-in min-w-0 flex-1 overflow-x-hidden">
        <Outlet />
      </main>

      <GptChatBubble />
    </div>
  )
}
