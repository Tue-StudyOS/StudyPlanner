import { useState } from 'react'
import type { MasterCat } from '../../courses'
import type { TranscriptCoursePreview } from '../types'
import { CategoryToggle } from './CategoryToggle'
import { CatalogCoursePicker } from './CatalogCoursePicker'

const ALL_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']

interface ManualCompletedCourseFormProps {
  defaultSemester: string | null | undefined
  studyProgramCode?: string | null
  isSaving: boolean
  onSave: (
    course: TranscriptCoursePreview,
    semester: string,
    grade: number | null,
    masterCat: MasterCat,
  ) => Promise<boolean>
}

function formatOptionalNumber(value: number | null): string {
  return value === null ? '' : String(value)
}

export function ManualCompletedCourseForm({
  defaultSemester,
  studyProgramCode,
  isSaving,
  onSave,
}: ManualCompletedCourseFormProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [selectedCourse, setSelectedCourse] = useState<TranscriptCoursePreview | null>(null)
  const [semester, setSemester] = useState<string>(defaultSemester ?? '')
  const [grade, setGrade] = useState<number | null>(null)
  const [masterCat, setMasterCat] = useState<MasterCat>('INFO')
  const [error, setError] = useState<string | null>(null)

  function resetForm(): void {
    setSelectedCourse(null)
    setSemester(defaultSemester ?? '')
    setGrade(null)
    setMasterCat('INFO')
    setError(null)
  }

  function openForm(): void {
    setIsOpen(true)
    setSemester(defaultSemester ?? '')
  }

  function handleCourseSelect(course: TranscriptCoursePreview): void {
    setSelectedCourse(course)
    setMasterCat(course.masterCats[0] ?? 'INFO')
    setError(null)
  }

  async function handleSave(): Promise<void> {
    if (!selectedCourse) {
      setError('Choose a catalog course first.')
      return
    }

    if (selectedCourse.ects === null) {
      setError('The selected catalog course does not expose ECTS yet. Please choose another course or try again later.')
      return
    }

    if (!semester.trim()) {
      setError('Enter the semester for this completed course.')
      return
    }

    const saved = await onSave(selectedCourse, semester.trim(), grade, masterCat)
    if (!saved) {
      return
    }

    resetForm()
    setIsOpen(false)
  }

  return (
    <div className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold text-fg">Add completed courses manually</div>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            Pick the catalog course first, then add your semester and optional grade.
          </p>
        </div>
        {!isOpen ? (
          <button
            type="button"
            onClick={openForm}
            className="rounded-md border border-border px-3.5 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            Add course manually
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="mt-4 grid gap-3.5">
          <CatalogCoursePicker
            selectedCourse={selectedCourse}
            studyProgramCode={studyProgramCode}
            onSelect={handleCourseSelect}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Semester
              </span>
              <input
                type="text"
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                placeholder="e.g. WS 2024/25"
                className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Grade
              </span>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={formatOptionalNumber(grade)}
                onChange={(event) => setGrade(event.target.value.trim() ? Number(event.target.value) : null)}
                placeholder="optional"
                className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
              />
            </label>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Category
            </div>
            <div className="flex flex-wrap gap-1">
              {ALL_CATEGORIES.map((cat) => (
                <CategoryToggle
                  key={cat}
                  cat={cat}
                  active={cat === masterCat}
                  onClick={() => setMasterCat(cat)}
                />
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setIsOpen(false)
              }}
              className="rounded-md border border-border px-3.5 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save completed course'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
