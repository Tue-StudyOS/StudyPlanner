import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { clearExpiredSessionCache } from './shared/utils/sessionCache.ts'

clearExpiredSessionCache()

// After a redeploy, a cached page can request old hashed chunks that no longer
// exist; the SPA fallback then serves HTML instead of JS and dynamic imports
// fail. Reload once to pick up the new asset manifest.
window.addEventListener('vite:preloadError', (event) => {
  const RELOAD_FLAG = 'chunk-reload-at'
  const lastReload = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0)
  if (Date.now() - lastReload > 30_000) {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
    event.preventDefault()
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
