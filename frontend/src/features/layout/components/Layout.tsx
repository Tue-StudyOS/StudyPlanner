import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'

export function Layout() {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-bg text-sm text-fg font-sans">
      <TopBar />
      <main
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <Outlet />
      </main>
    </div>
  )
}
