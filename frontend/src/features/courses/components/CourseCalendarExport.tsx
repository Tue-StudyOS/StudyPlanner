import { useState, type ReactElement } from 'react'
import { useTranslation } from '../../i18n'
import { buildCourseIcs, downloadCalendarIcs, getCourseExportTutorialOptions } from '../../planner/utils/icsExport.ts'
import type { Course } from '../types.ts'
import { buildExamDisplayEntries, partitionCourseSchedule } from '../utils/courseSchedule.ts'
import { parseDateSortValue } from '../utils/examLabels.ts'

export function CourseCalendarExport({ course, ready }: { course: Course; ready: boolean }): ReactElement {
  const { t } = useTranslation()
  const [tutorial, setTutorial] = useState('none')
  const [includeExams, setIncludeExams] = useState(true)
  const [includeResits, setIncludeResits] = useState(false)
  const tutorials = getCourseExportTutorialOptions(course)
  const content = ready ? buildCourseIcs(course, {
    tutorialSlotIds: tutorial === 'all' ? 'all' : tutorial === 'none' ? [] : [tutorial],
    includeExams,
    includeResits,
  }) : null
  const examEntries = buildExamDisplayEntries(partitionCourseSchedule(course.schedule).examAppointments, course.exams)
    .filter((entry) => parseDateSortValue(entry.date) !== null)
  const resitDates = [...new Set(examEntries.filter((entry) => /nachklausur|resit/i.test(entry.type)).map((entry) => entry.date))].join(' · ')
  const examDates = [...new Set(examEntries.filter((entry) => !/nachklausur|resit/i.test(entry.type) && /klausur|pruefung|prüfung|exam/i.test(entry.type)).map((entry) => entry.date))].join(' · ')

  return (
    <details className="mt-4 min-w-0 max-w-full rounded-lg border border-border px-3 py-2.5 text-[12px] text-fg">
      <summary className="cursor-pointer break-words font-medium">{t('planner.exportCalendar')}</summary>
      <fieldset disabled={!ready} className="mt-3 grid min-w-0 gap-3">
        {tutorials.length > 0 ? (
          <label className="grid min-w-0 gap-1.5">
            <span>{t('courseDetail.tutorialOptions')}</span>
            <select value={tutorial} onChange={(event) => setTutorial(event.target.value)} className="w-full min-w-0 max-w-full rounded-md border border-border bg-surface px-2 py-2 text-fg">
              <option value="none">{t('courseDetail.exportNoTutorials')}</option>
              <option value="all">{t('courseDetail.exportAllTutorials')}</option>
              {tutorials.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        ) : null}
        {examDates ? <label className="flex min-w-0 items-start gap-2"><input type="checkbox" checked={includeExams} onChange={(event) => setIncludeExams(event.target.checked)} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{t('courseDetail.exportExams')}<span className="mt-0.5 block text-[11px] text-fg-muted">{examDates}</span></span></label> : null}
        {resitDates ? <label className="flex min-w-0 items-start gap-2"><input type="checkbox" checked={includeResits} onChange={(event) => setIncludeResits(event.target.checked)} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{t('courseDetail.exportResits')}<span className="mt-0.5 block text-[11px] text-fg-muted">{resitDates}</span></span></label> : null}
        <p className="break-words text-[11px] leading-relaxed text-fg-muted">{t('courseDetail.calendarExportHint', { period: course.periodLabel ?? '' })}</p>
        {!content ? <p className="break-words text-[11px] text-fg-muted">{t('courseDetail.calendarExportUnavailable')}</p> : null}
        <button type="button" disabled={!content} onClick={() => {
          if (!content) return
          const filename = `studyplanner-${course.number || course.id}-${course.periodLabel}`.replace(/[<>:"/\\|?*\s]+/g, '-')
          downloadCalendarIcs(content, `${filename}.ics`)
        }} className="w-full max-w-full rounded-md border border-border px-3 py-2.5 font-medium hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">{t('courseDetail.exportDownload')}</button>
      </fieldset>
    </details>
  )
}
