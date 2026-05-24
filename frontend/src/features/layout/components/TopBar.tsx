import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useTheme } from '../../theme'
import { NAV } from '../nav'
import { MoonIcon, SunIcon } from './icons'
import { ROUTES } from '../../../config/routes'

export function TopBar() {
  const { isAuthenticated, logout, user } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  return (
    <header className="flex h-15 shrink-0 items-center bg-sidebar pl-8 pr-6">
      <a
        href="https://studyplaner.pages.dev/"
        className="mr-9 flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-90"
      >
        <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-md bg-brand">
          <span className="font-serif text-[13px] font-bold text-white">S</span>
        </div>
        <span className="font-serif text-lg font-semibold text-white">StudyOS</span>
      </a>

      <nav className="flex flex-1 gap-1">
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
                <span
                  className={`flex ${
                    isActive ? 'text-white' : 'text-white/55 group-hover:text-white'
                  }`}
                >
                  <Icon filled={isActive} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2.5 py-1.75 text-[13px] text-white/65 hover:bg-sidebar-hover hover:text-white"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

        {isAuthenticated && user ? (
          <>
            <span className="ml-2 text-[12px] text-white/70">{user.displayName}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md border border-white/10 bg-sidebar-hover px-3 py-1.5 text-[12px] font-medium text-white/80 hover:text-white"
            >
              Sign out
            </button>
          </>
        ) : (
          <NavLink
            to={ROUTES.account}
            className="ml-2 rounded-md border border-white/10 bg-sidebar-hover px-3 py-1.5 text-[12px] font-medium text-white/80 hover:text-white"
          >
            Sign in
          </NavLink>
        )}

        <span className="ml-1.5 text-xs text-white/50">SS 2026</span>
      </div>
    </header>
  )
}
