import { useEffect, useState, type ReactNode } from 'react'

const BASE_DELAY_MS = 90
const STEP_DELAY_MS = 170

// Staggered fade/slide-in that gives the "/test" surface its deliberate,
// box-by-box build-up. The delay grows with the item index.
export function RevealItem({ index = 0, children }: { index?: number; children: ReactNode }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShown(true), BASE_DELAY_MS + index * STEP_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [index])

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      {children}
    </div>
  )
}
