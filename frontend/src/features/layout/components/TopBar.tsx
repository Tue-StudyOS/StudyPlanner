import { NavLink } from 'react-router-dom'
import { useTheme } from '../../theme'
import { NAV } from '../nav'
import { MoonIcon, SunIcon } from './icons'
import { ROUTES } from '../../../config/routes'

export function TopBar() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <header className="flex items-center shrink-0 h-15 pl-8 pr-6 bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-9">
        <div className="flex items-center justify-center w-7.5 h-7.5 rounded-md shrink-0 bg-brand">
          <span className="text-[13px] font-bold text-white font-serif">S</span>
        </div>
        <span className="text-lg font-semibold text-white font-serif">StudyOS</span>
      </div>

      {/* Nav items */}
      <nav className="flex gap-1 flex-1">
        {NAV.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === ROUTES.dashboard}
            className={({ isActive }) =>
              `group flex items-center gap-2 px-3.5 py-2 rounded-md text-[13.5px] transition-all duration-150 ${
                isActive
                  ? 'bg-sidebar-active text-white font-semibold'
                  : 'bg-transparent text-white/65 font-medium hover:bg-sidebar-hover hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex ${isActive ? 'text-white' : 'text-white/55 group-hover:text-white'}`}>
                  <Icon filled={isActive} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Right: dark toggle + semester */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1.75 rounded-md border-0 text-[13px] cursor-pointer bg-transparent text-white/65 hover:bg-sidebar-hover hover:text-white"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        <span className="text-xs ml-1.5 text-white/50">SS 2026</span>
      </div>
    </header>
  )
}
