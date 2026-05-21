import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './features/theme'
import { Layout } from './features/layout'
import { Dashboard } from './features/dashboard'
import { CoursesOverview } from './features/courses'
import { Favorites, FavoritesProvider } from './features/favorites'
import { Transcript, TranscriptProvider } from './features/transcript'
import { ROUTES } from './features/routes'

function App() {
  return (
    <ThemeProvider>
      <FavoritesProvider>
        <TranscriptProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path={ROUTES.dashboard}  element={<Dashboard />} />
                <Route path={ROUTES.catalog}    element={<CoursesOverview />} />
                <Route path={ROUTES.favorites}  element={<Favorites />} />
                <Route path={ROUTES.transcript} element={<Transcript />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TranscriptProvider>
      </FavoritesProvider>
    </ThemeProvider>
  )
}

export default App
