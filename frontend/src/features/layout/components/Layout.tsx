import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-sm text-fg font-sans">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-20 bg-sidebar lg:hidden"
        style={{ height: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
      />
      <TopBar />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
