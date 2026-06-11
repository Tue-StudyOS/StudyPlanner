import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './features/auth'
import { ThemeProvider } from './features/theme'
import { Layout } from './features/layout'
import { FavoritesProvider } from './features/favorites'
import { TranscriptProvider } from './features/transcript'
import { OnboardingProvider } from './features/onboarding'
import { LEGACY_PLANNER_ROUTE, ROUTES } from './features/routes'

// Route components are lazy-loaded so the initial bundle only carries the
// shell and providers; each page becomes its own chunk.
const Dashboard = lazy(() =>
  import('./features/dashboard/components/Dashboard').then((module) => ({ default: module.Dashboard })),
)
const CoursesOverview = lazy(() =>
  import('./features/courses/components/Overview').then((module) => ({ default: module.CoursesOverview })),
)
const CourseDetail = lazy(() =>
  import('./features/courses/components/CourseDetail').then((module) => ({ default: module.CourseDetail })),
)
const Transcript = lazy(() =>
  import('./features/transcript/components/Transcript').then((module) => ({ default: module.Transcript })),
)
const SemesterPlanner = lazy(() =>
  import('./features/planner/components/SemesterPlanner').then((module) => ({ default: module.SemesterPlanner })),
)
const AccountPage = lazy(() =>
  import('./features/auth/components/AccountPage').then((module) => ({ default: module.AccountPage })),
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
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route path={ROUTES.planner} element={<SemesterPlanner />} />
                      <Route path={ROUTES.catalog} element={<CoursesOverview />} />
                      <Route path={ROUTES.catalogDetail} element={<CourseDetail />} />
                      <Route path={ROUTES.overview} element={<Dashboard />} />
                      <Route path={ROUTES.transcript} element={<Transcript />} />
                      <Route path={ROUTES.account} element={<AccountPage />} />
                      <Route
                        path={LEGACY_PLANNER_ROUTE}
                        element={<Navigate to={ROUTES.planner} replace />}
                      />
                    </Route>
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
