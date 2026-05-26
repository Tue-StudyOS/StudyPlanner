import { useState } from 'react'
import { Link, NavLink, useMatch } from 'react-router-dom'
import logo from '../../../assets/logo.png'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { NAV } from '../nav'
import { AccountIcon, CloseIcon, GearIcon, MenuIcon } from './icons'
import { ROUTES } from '../../../config/routes'

export function TopBar() {
  const isOnAccountPage = Boolean(useMatch(ROUTES.account))
  const isMobileNavigation = useMediaQuery('(max-width: 960px)')
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)

  return (
    <>
      <header
        className="sticky top-0 z-30 flex shrink-0 items-center justify-between bg-sidebar pl-4 pr-4 sm:pl-6 sm:pr-5 lg:pl-8 lg:pr-6"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 'calc(3.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <a
          href="https://studyplaner.pages.dev/"
          className="flex min-w-0 items-center gap-2 rounded-md transition-opacity hover:opacity-90"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white sm:h-7.5 sm:w-7.5">
            <img src={logo} alt="" className="h-full w-full object-contain p-0.5" />
          </div>
          <span className="truncate font-serif text-base font-semibold text-white sm:text-lg">
            StudyPlanner
          </span>
        </a>

        {isMobileNavigation ? (
          <button
            type="button"
            onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-sidebar-hover text-white/85 transition-colors hover:text-white"
          >
            {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        ) : (
          <>
            <nav className="mx-8 flex flex-1 gap-1">
              {NAV.map(({ path, label, Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === ROUTES.dashboard}
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
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

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
          </>
        )}
      </header>

      {isMobileNavigation && isMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-black/25 lg:hidden" onClick={() => setIsMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 flex h-full w-[18rem] flex-col border-l border-border bg-surface px-4 py-5 shadow-2xl"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-fg">Navigation</div>
                <div className="text-[12px] text-fg-muted">Compact mobile menu</div>
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
              {NAV.map(({ path, label, Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === ROUTES.dashboard}
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
                  <span>{label}</span>
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
                <span>Account</span>
              </NavLink>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  )
}
