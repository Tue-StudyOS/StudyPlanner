import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { ROUTES } from '../../routes'
import { useTheme } from '../../theme'
import { useBetaPlanner } from '../hooks/useBetaPlanner'
import { useStudyPlanOverview } from '../hooks/useStudyPlanOverview'
import { formatGrade } from '../utils/studyPlanOverview'
import { CoursePicker } from './CoursePicker'
import { RegulationProgressCard } from './RegulationProgressCard'
import { SemesterColumn } from './SemesterColumn'
import { Timetable } from './Timetable'

// Exact palette from the reference mockup.
const CARD =
  'rounded-[20px] border border-[#ece7db] bg-white shadow-[0_2px_10px_rgba(60,50,20,0.04)] dark:border-neutral-800 dark:bg-neutral-900'
const KPI_LABEL = 'text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#a39d90]'
const GOLD = 'text-[#b8790c] dark:text-[#d79a2e]'

function BetaHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#ece7db] bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/85 sm:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[15px] font-semibold text-[#221f19] dark:text-neutral-100">
          StudyPlanner
        </span>
        <span className="shrink-0 rounded-full bg-[#7c5cff]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6a3ef0] dark:text-[#a893e0]">
          Beta
        </span>
      </div>
      <Link
        to={ROUTES.planner}
        className="shrink-0 rounded-full border border-[#e0dbcd] bg-[#f3f0e7] px-3 py-1.5 text-[12px] font-semibold text-[#4a473f] transition-colors hover:bg-[#ece7db] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      >
        ← Klassische Ansicht
      </Link>
    </header>
  )
}

export function StudyPlanPage() {
  const { isAuthenticated } = useAuth()
  const { isDark } = useTheme()
  const { summary, semesters, regulationAreas, isLoading } = useStudyPlanOverview()
  const {
    favoriteCourses,
    plannedCourses,
    plannedCourseIds,
    hiddenSlotIds,
    isLoading: isLoadingPlanner,
    plannedEctsByArea,
    categoryControl,
    addCourse,
    removeCourse,
    selectTutorialSlot,
  } = useBetaPlanner()
  const plannedEcts = plannedCourses.reduce((sum, course) => sum + (course.ects ?? 0), 0)
  const plannedCategoryById = new Map(
    plannedCourses.map((course) => [course.id, categoryControl.categoryOf(course)]),
  )

  const requiredEcts = summary?.requiredEcts ?? 120
  const totalEcts = summary?.totalEcts ?? 0
  const completedRatio = requiredEcts > 0 ? Math.min(1, totalEcts / requiredEcts) : 0
  const remainingEcts = Math.max(0, requiredEcts - totalEcts)

  const pageBackground = isDark
    ? {
        backgroundColor: '#141317',
        backgroundImage:
          'radial-gradient(circle at 12% 0%, #7c5cff12, transparent 45%), radial-gradient(circle at 90% 10%, #e8a01010, transparent 40%)',
      }
    : {
        backgroundColor: '#f7f4ee',
        backgroundImage:
          'radial-gradient(circle at 12% 0%, #7c5cff14, transparent 45%), radial-gradient(circle at 90% 10%, #e8a01018, transparent 40%)',
      }

  return (
    <div className="min-h-screen text-[#221f19] dark:text-neutral-100" style={pageBackground}>
      <BetaHeader />

      <main className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-8">
        <div className="mb-6">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Studienplan</h1>
          <p className="mt-1 text-[13px] text-[#8a8478]">
            M.Sc. Informatik · dieselben Daten aus Transcript und manuell angelegten Kursen
          </p>
        </div>

        {!isAuthenticated ? (
          <div className={`${CARD} p-6 text-[13px] text-[#8a8478]`}>
            Bitte melde dich an, um deinen Studienplan zu sehen.
          </div>
        ) : (
          <>
            {/* Three summary panels */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={`${CARD} px-6 py-6 lg:col-span-2`}>
                <div className={KPI_LABEL}>ECTS im Studium</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className={`text-[30px] font-bold leading-none ${GOLD}`}>{totalEcts}</span>
                  <span className="text-[13px] text-[#8a8478]">abgeschlossen / {requiredEcts}</span>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#f0ece1] dark:bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-[#b8790c] transition-[width]"
                    style={{ width: `${completedRatio * 100}%` }}
                  />
                </div>
                <p className="mt-3 text-[12px] text-[#a39d90]">
                  Noch {remainingEcts} ECTS bis zum Abschluss.
                </p>
              </div>

              <div className={`${CARD} px-6 py-6`}>
                <div className={KPI_LABEL}>Fortschritt</div>
                <div className={`mt-2 text-[30px] font-bold leading-none ${GOLD}`}>
                  {summary ? (
                    <>
                      {summary.progressPercentage}
                      <span className="text-[16px] text-[#a39d90]">%</span>
                    </>
                  ) : (
                    '–'
                  )}
                </div>
                <p className="mt-3 text-[12px] text-[#a39d90]">des Studiengangs</p>
              </div>

              <div className={`${CARD} px-6 py-6`}>
                <div className={KPI_LABEL}>Ø-Note</div>
                <div className={`mt-2 text-[30px] font-bold leading-none ${GOLD}`}>
                  {summary ? formatGrade(summary.averageGrade) : '–'}
                </div>
                <p className="mt-3 text-[12px] text-[#a39d90]">gewichtet nach Noten</p>
              </div>
            </div>

            {/* Semesterverlauf */}
            <section className={`${CARD} rounded-[24px] p-6`}>
              <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Semesterverlauf</h2>
                <span className="text-[12.5px] text-[#a39d90]">
                  noch {remainingEcts} ECTS bis zum Abschluss · Kategorie pro Kurs änderbar
                </span>
              </div>

              {isLoading && semesters.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[#a39d90]">Lädt…</div>
              ) : (
                <div className="-mx-1 flex gap-3.5 overflow-x-auto px-1 pb-2">
                  {semesters.map((semester) => (
                    <SemesterColumn
                      key={semester.label}
                      semester={semester}
                      plannedCourses={semester.isOpen ? plannedCourses : undefined}
                      categoryControl={semester.isOpen ? categoryControl : undefined}
                      onRemovePlanned={semester.isOpen ? removeCourse : undefined}
                    />
                  ))}
                </div>
              )}
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.35fr]">
              <CoursePicker
                favoriteCourses={favoriteCourses}
                plannedCourseIds={plannedCourseIds}
                hiddenSlotIds={hiddenSlotIds}
                isLoading={isLoadingPlanner}
                categoryControl={categoryControl}
                onAdd={addCourse}
                onRemove={removeCourse}
                onSelectTutorial={selectTutorialSlot}
              />
              <Timetable
                plannedCourses={plannedCourses}
                hiddenSlotIds={hiddenSlotIds}
                plannedEcts={plannedEcts}
                categoryByCourseId={plannedCategoryById}
              />
            </div>

            <RegulationProgressCard areas={regulationAreas} plannedEctsByArea={plannedEctsByArea} />
          </>
        )}
      </main>
    </div>
  )
}
