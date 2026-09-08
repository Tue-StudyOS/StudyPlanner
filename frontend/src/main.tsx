import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BROWSER_STORAGE_KEYS } from './shared/utils/browserStorageRegistry.ts'
import { clearExpiredSessionCache } from './shared/utils/sessionCache.ts'
import { fetchJson } from './shared/utils/api.ts'
import { setSimulatedCurrentSemesterLabel } from './features/planner/utils/semesterLabels.ts'

clearExpiredSessionCache()

// After a redeploy, a cached page can request old hashed chunks that no longer
// exist; the SPA fallback then serves HTML instead of JS and dynamic imports
// fail. Reload once to pick up the new asset manifest.
window.addEventListener('vite:preloadError', (event) => {
  const lastReload = Number(sessionStorage.getItem(BROWSER_STORAGE_KEYS.chunkReloadAt) ?? 0)
  if (Date.now() - lastReload > 30_000) {
    sessionStorage.setItem(BROWSER_STORAGE_KEYS.chunkReloadAt, String(Date.now()))
    event.preventDefault()
    window.location.reload()
  }
})

interface AppConfigResponse {
  simulatedSemesterLabel?: string | null
}

// The simulated-semester toggle must be applied before any semester-dependent
// screen renders, so the boot waits briefly for /api/config. A failure or
// timeout simply falls back to the real calendar.
const APP_CONFIG_TIMEOUT_MS = 1500

async function applyRuntimeConfig(): Promise<void> {
  try {
    const config = await Promise.race([
      fetchJson<AppConfigResponse>('/api/config'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('config timeout')), APP_CONFIG_TIMEOUT_MS),
      ),
    ])
    setSimulatedCurrentSemesterLabel(config.simulatedSemesterLabel ?? null)
  } catch {
    setSimulatedCurrentSemesterLabel(null)
  }
}

function renderApp(): void {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void applyRuntimeConfig().finally(renderApp)
