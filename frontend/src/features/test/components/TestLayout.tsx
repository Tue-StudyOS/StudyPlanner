import { useLayoutEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../../assets/logo.png'
import { ROUTES, TEST_ROUTES } from '../../routes'
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

function SlidersMenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="7" r="1.7" fill="currentColor" />
      <circle cx="15" cy="12" r="1.7" fill="currentColor" />
      <circle cx="11" cy="17" r="1.7" fill="currentColor" />
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
    <div className="absolute right-0 top-full z-[100] mt-2 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-border bg-surface shadow-2xl">
      {user ? (
        <div className="border-b border-border px-4 py-3 text-[12px] font-medium text-fg-muted">
          {user.username}
        </div>
      ) : null}
      <div className="grid gap-1 p-1.5">
        <Link
          to={ROUTES.account}
          onClick={onClose}
          className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
        >
          <span>{t('nav.account')}</span>
          <span className="text-[11px] text-fg-muted">/account</span>
        </Link>
        <Link
          to={ROUTES.transcript}
          onClick={onClose}
          className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
        >
          <span>{t('nav.transcript')}</span>
          <span className="text-[11px] text-fg-muted">/transcript</span>
        </Link>
        {user ? (
          <button
            type="button"
            className="flex w-full items-center rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-danger transition-colors hover:bg-surface-hover"
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
  const settingsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useLayoutEffect(() => {
    if (!settingsOpen) return
    function handleOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [settingsOpen])

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-sm text-fg font-sans">
      <header
        data-app-topbar
        className="sticky top-0 z-[80] flex shrink-0 items-center justify-between gap-3 bg-sidebar px-4 [transform:translateZ(0)] sm:px-6 lg:px-8"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(3.75rem + env(safe-area-inset-top, 0px))' }}
      >
        {atRoot ? (
          <Link to={TEST_ROUTES.root} className="flex min-w-0 items-center gap-2 rounded-md transition-opacity hover:opacity-90">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white sm:h-7.5 sm:w-7.5">
              <img src={logo} alt="" className="h-full w-full object-contain p-0.5" />
            </div>
            <span className="truncate font-serif text-base font-semibold text-white sm:text-lg">
              StudyPlanner
            </span>
          </Link>
        ) : (
          <Link
            to={parentPath}
            className="flex min-w-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] font-semibold text-white/75 transition-colors hover:bg-sidebar-hover hover:text-white"
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
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-sidebar-hover text-white/80 transition-colors hover:text-white"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              aria-label={t('nav.settings')}
              aria-expanded={settingsOpen}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-sidebar-hover text-white/85 transition-colors hover:text-white"
            >
              <SlidersMenuIcon />
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
