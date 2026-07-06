import { useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { FeedbackWidget } from '../../feedback'
import { ROUTES } from '../../routes'
import { TopBar } from './TopBar'

function isCatalogRoute(pathname: string): boolean {
  return pathname === ROUTES.catalog || pathname.startsWith(`${ROUTES.catalog}/`)
}

export function Layout() {
  const location = useLocation()
  const catalogScrollPane = isCatalogRoute(location.pathname)

  useLayoutEffect(() => {
    const scrollingElement = document.scrollingElement ?? document.documentElement
    scrollingElement.scrollTop = 0
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-bg text-sm text-fg font-sans">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-20 bg-sidebar lg:hidden"
        style={{ height: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
      />
      <TopBar />
      <main
        className={
          catalogScrollPane
            ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
            : 'min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain'
        }
      >
        <Outlet />
      </main>
      <FeedbackWidget />
    </div>
  )
}
