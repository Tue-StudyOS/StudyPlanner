import { useState } from 'react'
import { Link, NavLink, useLocation, useMatch } from 'react-router-dom'
import logo from '../../../assets/logo.png'
import { CloseIcon } from '../../../shared/components/icons'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { NAV } from '../nav'
import { AccountIcon, GearIcon, MenuIcon, MoonIcon, SunIcon } from './icons'
import { useTranslation } from '../../i18n'
import { HelpButton, useOnboarding } from '../../onboarding'
import { HelpIcon } from '../../onboarding/components/icons'
import { ROUTES } from '../../routes'
import { useTheme } from '../../theme'
import { useSemesterTabBadge } from '../../planner/utils/semesterTabBadge.ts'

const STUDYOS_BOT_URL = 'https://chatgpt.com/g/g-6a2de082a0b88191b833f7307d0c9429-studyos-bot'

function isSemesterNavActive(pathname: string): boolean {
  return pathname === ROUTES.planner || pathname.startsWith('/semester/')
}

export function TopBar() {
  const location = useLocation()
  const isOnAccountPage = Boolean(useMatch(ROUTES.account))
  const isMobileNavigation = useMediaQuery('(max-width: 960px)')
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const { isDark, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const { open: openTour } = useOnboarding()
  const showSemesterTabBadge = useSemesterTabBadge()

  const askGptButton = (
    <a
      href={STUDYOS_BOT_URL}
      target="_blank"
      rel="noreferrer noopener"
      className="flex h-10 items-center justify-center rounded-md border border-white/10 bg-sidebar-hover px-2.5 text-[12px] font-semibold text-white/85 transition-colors hover:text-white sm:px-3"
    >
      <span className="hidden sm:inline">{t('askGpt.button')}</span>
      <span className="sm:hidden">GPT</span>
    </a>
  )

  const betaButton = (
    <Link
      to={ROUTES.beta}
      className="flex h-10 items-center justify-center rounded-md border border-white/10 bg-sidebar-hover px-2.5 text-[12px] font-semibold text-white/85 transition-colors hover:text-white sm:px-3"
    >
      Test UI
    </Link>
  )

  const themeToggleButton = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-sidebar-hover text-white/80 transition-colors hover:text-white"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )

  function navLinkClass(isActive: boolean): string {
    return `group relative flex items-center gap-2 rounded-md px-3.5 py-2 text-[13.5px] transition-all duration-150 ${
      isActive
        ? 'bg-sidebar-active font-semibold text-white'
        : 'bg-transparent font-medium text-white/65 hover:bg-sidebar-hover hover:text-white'
    }`
  }

  function resolveNavActive(path: string, isActive: boolean): boolean {
    if (path === ROUTES.planner) {
      return isSemesterNavActive(location.pathname)
    }
    return isActive
  }

  return (
    <>
      <header
        data-app-topbar
        className="sticky top-0 z-[80] flex shrink-0 items-center justify-between bg-sidebar pl-4 pr-4 [transform:translateZ(0)] sm:pl-6 sm:pr-5 lg:pl-8 lg:pr-6"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(3.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <Link
          to={ROUTES.catalog}
          className="flex min-w-0 items-center gap-2 rounded-md transition-opacity hover:opacity-90"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white sm:h-7.5 sm:w-7.5">
            <img src={logo} alt="" className="h-full w-full object-contain p-0.5" />
          </div>
          <span className="truncate font-serif text-base font-semibold text-white sm:text-lg">
            StudyPlanner
          </span>
        </Link>

        {isMobileNavigation ? (
          <div className="flex min-w-0 shrink items-center gap-2">
            {betaButton}
            {askGptButton}
            <HelpButton />
            {themeToggleButton}
            <button
              type="button"
              onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-sidebar-hover text-white/85 transition-colors hover:text-white"
            >
              {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        ) : (
          <>
            <nav className="mx-8 flex flex-1 gap-1">
              {NAV.map(({ path, labelKey, Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === ROUTES.planner ? false : path === ROUTES.catalog}
                  className={({ isActive }) => navLinkClass(resolveNavActive(path, isActive))}
                >
                  {({ isActive }) => {
                    const active = resolveNavActive(path, isActive)
                    return (
                      <>
                        <span className={`flex ${active ? 'text-white' : 'text-white/55 group-hover:text-white'}`}>
                          <Icon />
                        </span>
                        {t(labelKey)}
                        {path === ROUTES.planner && showSemesterTabBadge ? (
                          <span
                            aria-label={t('nav.semesterNewCourses')}
                            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"
                          />
                        ) : null}
                      </>
                    )
                  }}
                </NavLink>
              ))}
            </nav>

            <div className="flex min-w-0 shrink items-center gap-2">
              {betaButton}
              {askGptButton}
              <HelpButton />
              {themeToggleButton}
              <Link
                to={ROUTES.account}
                aria-label="Open account settings"
                className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
                  isOnAccountPage
                    ? 'border-white/30 bg-sidebar-active text-white'
                    : 'border-white/10 bg-sidebar-hover text-white/80 hover:text-white'
                }`}
              >
                <GearIcon />
              </Link>
            </div>
          </>
        )}
      </header>

      {isMobileNavigation && isMenuOpen ? (
        <div className="fixed inset-0 z-[90] bg-black/25 lg:hidden" onClick={() => setIsMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 flex h-full w-[18rem] flex-col border-l border-border bg-surface px-4 py-5 shadow-2xl"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-fg">{t('nav.mobileTitle')}</div>
                <div className="text-[12px] text-fg-muted">{t('nav.mobileSubtitle')}</div>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="rounded-md border border-border px-2.5 py-2 text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <CloseIcon />
              </button>
            </div>

            <nav className="grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false)
                  openTour()
                }}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] text-fg transition-colors hover:bg-surface-hover"
              >
                <HelpIcon />
                <span>{t('help.open')}</span>
              </button>
              {NAV.map(({ path, labelKey, Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === ROUTES.planner ? false : path === ROUTES.catalog}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) => {
                    const active = resolveNavActive(path, isActive)
                    return `relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors ${
                      active ? 'bg-primary text-white' : 'text-fg hover:bg-surface-hover'
                    }`
                  }}
                >
                  <Icon />
                  <span>{t(labelKey)}</span>
                  {path === ROUTES.planner && showSemesterTabBadge ? (
                    <span
                      aria-label={t('nav.semesterNewCourses')}
                      className="ml-auto h-2 w-2 rounded-full bg-red-500"
                    />
                  ) : null}
                </NavLink>
              ))}
              <NavLink
                to={ROUTES.account}
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors ${
                    isActive ? 'bg-primary text-white' : 'text-fg hover:bg-surface-hover'
                  }`
                }
              >
                <AccountIcon />
                <span>{t('nav.account')}</span>
              </NavLink>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  )
}
