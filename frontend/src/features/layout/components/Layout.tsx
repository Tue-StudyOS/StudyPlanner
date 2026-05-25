import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'

export function Layout() {
  return (
    <div
      className="flex flex-col h-screen text-sm font-sans bg-bg text-fg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <TopBar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
