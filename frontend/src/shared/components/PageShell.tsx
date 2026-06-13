import type { JSX, ReactNode } from 'react'
import { PAGE_SHELL_WIDTH_CLASSES, type PageShellWidth } from '../utils/pageShell.ts'

export function PageShell({
  children,
  width = 'default',
  className = '',
}: {
  children: ReactNode
  width?: PageShellWidth
  className?: string
}): JSX.Element {
  return (
    // No max-w-full alongside the cap: it sorts later in the generated CSS
    // and would override the width variant, making every page full width.
    <div className={`mx-auto w-full min-w-0 ${PAGE_SHELL_WIDTH_CLASSES[width]} p-4 sm:p-8 sm:pt-6 ${className}`}>
      {children}
    </div>
  )
}
