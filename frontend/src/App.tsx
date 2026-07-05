import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider, StudySetupGate } from './features/auth'
import { ThemeProvider } from './features/theme'
import { Layout } from './features/layout'
import { FavoritesProvider } from './features/favorites'
import { TranscriptProvider } from './features/transcript'
import { OnboardingProvider } from './features/onboarding'
import { LEGACY_CATALOG_ROUTE, LEGACY_PLANNER_ROUTE, ROUTES } from './features/routes'

// Route components are lazy-loaded so the initial bundle only carries the
// shell and providers; each page becomes its own chunk.
const CoursesOverview = lazy(() =>
  import('./features/courses/components/Overview').then((module) => ({ default: module.CoursesOverview })),
)
const Transcript = lazy(() =>
  import('./features/transcript/components/Transcript').then((module) => ({ default: module.Transcript })),
)
const SemesterHub = lazy(() =>
  import('./features/planner/components/SemesterHub').then((module) => ({ default: module.SemesterHub })),
)
const SemesterPlanPage = lazy(() =>
  import('./features/planner/components/SemesterPlanPage').then((module) => ({ default: module.SemesterPlanPage })),
)
const AccountPage = lazy(() =>
  import('./features/auth/components/AccountPage').then((module) => ({ default: module.AccountPage })),
)
const RequestLogPage = lazy(() =>
  import('./features/diagnostics/components/RequestLogPage').then((module) => ({
    default: module.RequestLogPage,
  })),
)
const StudyPlanBeta = lazy(() =>
  import('./features/newui').then((module) => ({ default: module.StudyPlanPage })),
)

function RouteFallback() {
  return <div className="p-8 text-[13px] text-fg-muted">Loading…</div>
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FavoritesProvider>
          <TranscriptProvider>
            <BrowserRouter>
              <OnboardingProvider>
                <StudySetupGate />
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route path="/" element={<Navigate to={LEGACY_CATALOG_ROUTE} replace />} />
                      <Route path={ROUTES.planner} element={<SemesterHub />} />
                      <Route path={ROUTES.semesterDetail} element={<SemesterPlanPage />} />
                      <Route path={LEGACY_CATALOG_ROUTE} element={<Navigate to={ROUTES.catalog} replace />} />
                      {/* The course detail renders as a URL-driven drawer inside
                          the catalog; the child route only makes
                          '/catalog/:courseId' a valid deep link. */}
                      <Route path={ROUTES.catalog} element={<CoursesOverview />}>
                        <Route path=":courseId" element={null} />
                      </Route>
                      <Route path={ROUTES.transcript} element={<Transcript />} />
                      <Route path={ROUTES.account} element={<AccountPage />} />
                      <Route path={ROUTES.log} element={<RequestLogPage />} />
                      <Route
                        path={LEGACY_PLANNER_ROUTE}
                        element={<Navigate to={ROUTES.planner} replace />}
                      />
                    </Route>
                    <Route path={ROUTES.beta} element={<StudyPlanBeta />} />
                  </Routes>
                </Suspense>
              </OnboardingProvider>
            </BrowserRouter>
          </TranscriptProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
