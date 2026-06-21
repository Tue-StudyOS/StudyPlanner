import { useEffect } from 'react'

/**
 * Locks <body> scrolling while a modal/overlay is mounted, so wheel and touch
 * scrolling stays inside the overlay instead of moving the page behind it.
 * Restores the previous overflow value on unmount.
 */
export function useBodyScrollLock(): void {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previousOverflow
    }
  }, [])
}
