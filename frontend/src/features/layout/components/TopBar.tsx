import { useState } from 'react'
import { Link, NavLink, useMatch } from 'react-router-dom'
import logo from '../../../assets/logo.png'
import { CloseIcon } from '../../../shared/components/icons'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { NAV } from '../nav'
import { AccountIcon, GearIcon, MenuIcon, MoonIcon, SunIcon } from './icons'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { HelpButton } from '../../onboarding'
import { ROUTES } from '../../routes'
import { useTheme } from '../../theme'

export function TopBar() {
  const isOnAccountPage = Boolean(useMatch(ROUTES.account))
  const isMobileNavigation = useMediaQuery('(max-width: 960px)')
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const { isDark, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()

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

  return (
    <>
      <header
        data-app-topbar
        className="sticky top-0 z-[80] flex shrink-0 items-center justify-between bg-sidebar pl-4 pr-4 [transform:translateZ(0)] sm:pl-6 sm:pr-5 lg:pl-8 lg:pr-6"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(3.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <Link
          to={ROUTES.planner}
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
          <div className="flex items-center gap-2">
            {isAuthenticated ? <HelpButton /> : null}
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
                  end={path === ROUTES.planner}
                  className={({ isActive }) =>
                    `group flex items-center gap-2 rounded-md px-3.5 py-2 text-[13.5px] transition-all duration-150 ${
                      isActive
                        ? 'bg-sidebar-active font-semibold text-white'
                        : 'bg-transparent font-medium text-white/65 hover:bg-sidebar-hover hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`flex ${isActive ? 'text-white' : 'text-white/55 group-hover:text-white'}`}>
                        <Icon />
                      </span>
                      {t(labelKey)}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {isAuthenticated ? <HelpButton /> : null}
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
              {NAV.map(({ path, labelKey, Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === ROUTES.planner}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-fg hover:bg-surface-hover'
                    }`
                  }
                >
                  <Icon />
                  <span>{t(labelKey)}</span>
                </NavLink>
              ))}
              <NavLink
                to={ROUTES.account}
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-fg hover:bg-surface-hover'
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
