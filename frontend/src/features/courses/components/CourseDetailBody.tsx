import type { ReactNode } from 'react'
import { AreaBadge } from '../../../shared/components/AreaBadge'
import { SeasonTags } from '../../../shared/components/SeasonTag'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import type { Course } from '../types'
import { buildAlmaCourseUrl } from '../utils/almaUrl.ts'
import { getRecentSeasonTermType } from '../utils/catalogOffering.ts'
import { buildCourseAreaTags } from '../utils/courseCardDisplay.ts'
import { cleanCourseTitle, formatCourseTypeLabel } from '../utils/courseTitle.ts'
import { getExamDisplayLabel } from '../utils/examLabels.ts'
import { buildIliasMetadataRows, hasIliasMetadata } from '../utils/illiasMetadata.ts'
import { WeeklyScheduleMiniGrid } from './WeeklyScheduleMiniGrid'

const EMPTY_VALUES = new Set(['', '–', '-', 'tba', 'unknown', 'no registration period published'])

function hasValue(value: string | null | undefined): value is string {
  return Boolean(value) && !EMPTY_VALUES.has(value!.trim().toLowerCase())
}

function formatEcts(ects: number | null): string | null {
  if (ects === null) return null
  return Number.isInteger(ects) ? String(ects) : ects.toFixed(1)
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {title}
      </div>
      <div className="h-px w-full bg-border-light" />
      <div className="mt-3">{children}</div>
    </section>
  )
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-pill-border bg-pill-bg px-2.5 py-0.75 text-[11px] font-medium text-pill-text">
      {label}
    </span>
  )
}

interface CourseDetailBodyProps {
  course: Course
  /** Rendered at the very bottom, e.g. add/remove plan actions. */
  footer?: ReactNode
}

/**
 * Shared course detail content for the catalog drawer, the detail route, and
 * the planner's centered detail modal. Only renders information that exists —
 * with the deliberate exception of the Moodle/Ilias slot, which shows an
 * explicit empty state.
 */
export function CourseDetailBody({ course, footer }: CourseDetailBodyProps) {
  const { language, t } = useTranslation()
  const { user } = useAuth()
  const areaTags = buildCourseAreaTags(course, user?.profile.studyProgramCode ?? null)
  const title = cleanCourseTitle(course.title, course.number)
  const learningPlatformLinks = (course.externalLinks ?? []).filter((link) =>
    ['moodle', 'ilias'].includes(link.platform.trim().toLowerCase()),
  )
  const almaUrl = buildAlmaCourseUrl(course.detailUrl)
  const seasonTermType = getRecentSeasonTermType(course)
  const illiasRows = buildIliasMetadataRows(course.illias, {
    availability: t('courseDetail.illiasAvailability'),
    deadline: t('courseDetail.illiasDeadline'),
    instructors: t('courseDetail.illiasInstructors'),
    maxParticipants: t('courseDetail.illiasMaxParticipants'),
    registration: t('courseDetail.illiasRegistration'),
  })

  const factRows: Array<[string, string]> = []
  if (hasValue(course.number)) factRows.push([t('courseDetail.courseNumber'), course.number])
  if (hasValue(course.lecturer)) factRows.push([t('courseDetail.lecturer'), course.lecturer])
  const ectsText = formatEcts(course.ects)
  if (ectsText) factRows.push(['ECTS', ectsText])
  if (course.sws !== null) factRows.push(['SWS', `${course.sws} SWS`])
  if (hasValue(course.language)) factRows.push([t('courseDetail.language'), course.language])
  if (hasValue(course.frequency)) factRows.push([t('courseDetail.frequency'), course.frequency])
  if (hasValue(course.registrationPeriod)) factRows.push([t('courseDetail.registration'), course.registrationPeriod!])

  const regulationOptions = (course.studyAreaOptions ?? []).filter(
    (option) => option.studyAreaCode,
  )

  return (
    <div className="min-w-0">
      <div className="relative mb-6 min-w-0 rounded-[14px] border border-border bg-surface px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <TypePill label={formatCourseTypeLabel(course.types)} />
          {areaTags.map((tag) => (
            <AreaBadge key={tag.key} label={tag.label} masterCat={tag.masterCat} />
          ))}
        </div>

        <h1 className="break-words font-serif text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg sm:text-[22px]">
          {title}
        </h1>

        {seasonTermType !== 'unknown' || (course.offeredPeriods?.length ?? 0) > 0 ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <SeasonTags termType={seasonTermType} />
            {(course.offeredPeriods ?? []).map((periodLabel) => (
              <span
                key={periodLabel}
                className="whitespace-nowrap rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[10.5px] font-medium text-fg-mid"
              >
                {periodLabel}
              </span>
            ))}
          </div>
        ) : null}

      </div>

      {hasValue(course.description) ? (
        <Section title={t('courseDetail.description')}>
          <p className="whitespace-pre-wrap text-[13.5px] leading-7 text-fg-mid">
            {course.description}
          </p>
        </Section>
      ) : null}

      {hasValue(course.contents) ? (
        <Section title={t('courseDetail.contents')}>
          <p className="whitespace-pre-wrap text-[13.5px] leading-7 text-fg-mid">
            {course.contents}
          </p>
        </Section>
      ) : null}

      {hasIliasMetadata(course.illias) ? (
        <Section title={t('courseDetail.illias')}>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={course.illias.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center rounded-full border border-primary/30 bg-primary-soft px-3 py-1.5 text-[12.5px] font-semibold text-primary hover:underline"
              >
                <span className="truncate">{t('courseDetail.openIlias')}</span>
              </a>
              {course.illias.title && course.illias.title !== course.title ? (
                <span className="min-w-0 break-words text-[12px] text-fg-muted">
                  {course.illias.title}
                </span>
              ) : null}
            </div>

            {illiasRows.length > 0 ? (
              <div className="grid min-w-0 overflow-hidden rounded-lg border border-border-light bg-surface">
                {illiasRows.map((row, index) => (
                  <div
                    key={row.key}
                    className={`grid min-w-0 grid-cols-[minmax(6.5rem,8rem)_minmax(0,1fr)] gap-3 px-3.5 py-2.5 text-[12.5px] ${
                      index < illiasRows.length - 1 ? 'border-b border-border-light' : ''
                    }`}
                  >
                    <span className="font-medium text-fg-muted">{row.label}</span>
                    <span className="min-w-0 break-words text-fg">{row.value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {hasValue(course.illias.description) ? (
              <p className="whitespace-pre-wrap text-[13.5px] leading-7 text-fg-mid">
                {course.illias.description}
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section title={t('courseDetail.weeklySchedule')}>
        <WeeklyScheduleMiniGrid schedule={course.schedule} />
      </Section>

      {course.exams.length > 0 ? (
        <Section title={t('courseDetail.examDates')}>
          <div className="flex flex-col gap-2">
            {course.exams.map((exam, index) => (
              <div
                key={`${exam.type}-${exam.date}-${index}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border border-l-[3px] border-l-primary bg-surface px-4 py-3"
              >
                <span className="min-w-0 flex-1 break-words text-[13.5px] font-medium text-fg">
                  {getExamDisplayLabel(course.exams, index, language)}
                </span>
                <div className="flex shrink-0 items-center gap-3 text-[12.5px] text-fg-muted">
                  {hasValue(exam.date) ? <span>{exam.date}</span> : null}
                  {hasValue(exam.duration) ? <span>{exam.duration}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {course.prerequisites.length > 0 ? (
        <Section title={t('courseDetail.prerequisites')}>
          <ul className="flex flex-col gap-1.5">
            {course.prerequisites.map((prerequisite) => (
              <li
                key={prerequisite}
                className="flex items-baseline gap-2.5 text-[13.5px] text-fg-mid"
              >
                <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>{prerequisite}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {regulationOptions.length > 0 ? (
        <Section title={t('courseDetail.countsToward')}>
          <div className="grid gap-1.5">
            {regulationOptions.map((option) => (
              <div
                key={`${option.programCode}-${option.studyAreaCode}-${option.moduleCode}`}
                className="grid min-w-0 grid-cols-[minmax(4.5rem,7rem)_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 text-[12.5px] text-fg-mid sm:grid-cols-[minmax(6rem,8.5rem)_minmax(0,1fr)_auto]"
              >
                <span className="min-w-0 truncate font-medium text-fg">{option.studyAreaCode}</span>
                {option.studyAreaName ? <span className="min-w-0 break-words">{option.studyAreaName}</span> : <span />}
                {option.ectsCounted !== null ? (
                  <span className="col-start-2 whitespace-nowrap text-fg-muted sm:col-start-auto">
                    {option.ectsCounted} ECTS
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title={t('courseDetail.links')}>
        <div className="grid gap-2 text-[13px]">
          {learningPlatformLinks.length > 0 ? (
            learningPlatformLinks.map((link) => (
              <a
                key={`${link.platform}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {link.label || `Open ${link.platform}`}
              </a>
            ))
          ) : (
            <div className="text-fg-muted">{t('courseDetail.noLearningLink')}</div>
          )}
          {almaUrl ? (
            <a href={almaUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {t('courseDetail.openAlma')}
            </a>
          ) : null}
        </div>
      </Section>

      {factRows.length > 0 ? (
        <div className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="border-b border-border px-4.5 py-3 text-[13px] font-semibold text-fg">
            {t('courseDetail.facts')}
          </div>
          {factRows.map(([key, value], index) => (
            <div
              key={key}
              className={`grid min-w-0 grid-cols-[110px_minmax(0,1fr)] gap-3 px-4.5 py-3 ${
                index < factRows.length - 1 ? 'border-b border-border-light' : ''
              }`}
            >
              <span className="text-[12px] font-medium text-fg-muted">{key}</span>
              <span className="break-words text-[13px] text-fg">{value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  )
}
