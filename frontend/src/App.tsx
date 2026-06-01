import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, AccountPage } from './features/auth'
import { ThemeProvider } from './features/theme'
import { Layout } from './features/layout'
import { Dashboard } from './features/dashboard'
import { CourseDetail, CoursesOverview } from './features/courses'
import { FavoritesProvider } from './features/favorites'
import { Transcript, TranscriptProvider } from './features/transcript'
import { SemesterPlanner } from './features/planner'
import { ROUTES } from './features/routes'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FavoritesProvider>
          <TranscriptProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path={ROUTES.dashboard} element={<Dashboard />} />
                  <Route path={ROUTES.catalog} element={<CoursesOverview />} />
                  <Route path={ROUTES.catalogDetail} element={<CourseDetail />} />
                  <Route path={ROUTES.transcript} element={<Transcript />} />
                  <Route path={ROUTES.planner} element={<SemesterPlanner />} />
                  <Route path={ROUTES.account} element={<AccountPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </TranscriptProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
