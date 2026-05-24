import { Link, NavLink, useMatch } from 'react-router-dom'
import logo from '../../../assets/logo.png'
import { NAV } from '../nav'
import { GearIcon } from './icons'
import { ROUTES } from '../../../config/routes'

export function TopBar() {
  const isOnAccountPage = Boolean(useMatch(ROUTES.account))

  return (
    <header className="flex h-15 shrink-0 items-center bg-sidebar pl-8 pr-6">
      <a
        href="https://studyplaner.pages.dev/"
        className="mr-9 flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-90"
      >
        <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
          <img src={logo} alt="" className="h-full w-full object-contain p-0.5" />
        </div>
        <span className="font-serif text-lg font-semibold text-white">StudyPlanner</span>
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
                <span className={`flex ${isActive ? 'text-white' : 'text-white/55 group-hover:text-white'}`}>
                  <Icon />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2">
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
    </header>
  )
}
