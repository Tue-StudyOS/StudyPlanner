import { useEffect, useState, type ReactNode } from 'react'

const BASE_DELAY_MS = 60
const STEP_DELAY_MS = 80

export function RevealItem({ index = 0, children }: { index?: number; children: ReactNode }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShown(true), BASE_DELAY_MS + index * STEP_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [index])

  return (
    <div
      className={`transition-all duration-350 ease-out ${
        shown ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}
    >
      {children}
    </div>
  )
}
