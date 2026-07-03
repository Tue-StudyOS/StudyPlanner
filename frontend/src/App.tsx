import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, StudySetupGate } from './features/auth'
import { ThemeProvider } from './features/theme'
import { Layout } from './features/layout'
import { FavoritesProvider } from './features/favorites'
import { TranscriptProvider } from './features/transcript'
import { OnboardingProvider } from './features/onboarding'
import { LEGACY_PLANNER_ROUTE, LEGACY_CATALOG_ROUTE, ROUTES, TEST_ROUTES } from './features/routes'

// Route components are lazy-loaded so the initial bundle only carries the
// shell and providers; each page becomes its own chunk.
const Dashboard = lazy(() =>
  import('./features/dashboard/components/Dashboard').then((module) => ({ default: module.Dashboard })),
)
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
const TestLayout = lazy(() =>
  import('./features/test').then((module) => ({ default: module.TestLayout })),
)
const TestLanding = lazy(() =>
  import('./features/test').then((module) => ({ default: module.TestLanding })),
)
const TestCatalog = lazy(() =>
  import('./features/test').then((module) => ({ default: module.TestCatalog })),
)
const TestPersonal = lazy(() =>
  import('./features/test').then((module) => ({ default: module.TestPersonal })),
)
const TestProgress = lazy(() =>
  import('./features/test').then((module) => ({ default: module.TestProgress })),
)
const TestSemesters = lazy(() =>
  import('./features/test').then((module) => ({ default: module.TestSemesters })),
)
const TestSemesterDetail = lazy(() =>
  import('./features/test').then((module) => ({ default: module.TestSemesterDetail })),
)
const TestSemesterPlan = lazy(() =>
  import('./features/test').then((module) => ({ default: module.TestSemesterPlan })),
)
const TestSemesterEditor = lazy(() =>
  import('./features/test').then((module) => ({ default: module.TestSemesterEditor })),
)

function RouteFallback() {
  return <div className="p-8 text-[13px] text-fg-muted">Loading…</div>
}

// The "/test" surface drives onboarding inline, so the global blocking setup
// dialog must not overlay it.
function GlobalStudySetupGate() {
  const location = useLocation()
  if (location.pathname.startsWith(TEST_ROUTES.root)) {
    return null
  }
  return <StudySetupGate />
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FavoritesProvider>
          <TranscriptProvider>
            <BrowserRouter>
              <OnboardingProvider>
                <GlobalStudySetupGate />
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route path={ROUTES.planner} element={<SemesterHub />} />
                      <Route path={ROUTES.semesterDetail} element={<SemesterPlanPage />} />
                      <Route path={LEGACY_CATALOG_ROUTE} element={<Navigate to={ROUTES.catalog} replace />} />
                      {/* The course detail renders as a URL-driven drawer inside
                          the catalog; the child route only makes
                          '/catalog/:courseId' a valid deep link. */}
                      <Route path={ROUTES.catalog} element={<CoursesOverview />}>
                        <Route path=":courseId" element={null} />
                      </Route>
                      <Route path={ROUTES.overview} element={<Dashboard />} />
                      <Route path={ROUTES.transcript} element={<Transcript />} />
                      <Route path={ROUTES.account} element={<AccountPage />} />
                      <Route
                        path={LEGACY_PLANNER_ROUTE}
                        element={<Navigate to={ROUTES.planner} replace />}
                      />
                    </Route>
                    <Route path={TEST_ROUTES.root} element={<TestLayout />}>
                      <Route index element={<TestLanding />} />
                      <Route path="catalog" element={<TestCatalog />}>
                        <Route path=":courseId" element={null} />
                      </Route>
                      <Route path="personal" element={<TestPersonal />} />
                      <Route path="personal/progress" element={<TestProgress />} />
                      <Route path="personal/semesters" element={<TestSemesters />} />
                      <Route path="personal/semesters/:label" element={<TestSemesterDetail />} />
                      <Route path="personal/semesters/:label/plan" element={<TestSemesterPlan />} />
                      <Route path="personal/semesters/:label/editor" element={<TestSemesterEditor />} />
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
