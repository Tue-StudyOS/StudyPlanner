import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const IDLE_HIDE_DELAY_MS = 800

/**
 * Returns a ref for a scroll container whose scrollbar stays hidden until the
 * user scrolls (an `is-scrolling` class is toggled; the CSS in `index.css` shows
 * the thumb while it is present, then hides it a short moment after scrolling).
 */
export function useAutoHideScrollbar(): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    let hideTimeout: number | undefined
    function handleScroll(): void {
      const node = ref.current
      if (!node) {
        return
      }
      node.classList.add('is-scrolling')
      window.clearTimeout(hideTimeout)
      hideTimeout = window.setTimeout(() => node.classList.remove('is-scrolling'), IDLE_HIDE_DELAY_MS)
    }
    element.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', handleScroll)
      window.clearTimeout(hideTimeout)
    }
  }, [])

  return ref
}
