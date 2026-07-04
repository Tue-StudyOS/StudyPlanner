import type { ReactNode } from 'react'
import { SeasonSymbol } from '../../../shared/components/SeasonSymbol'
import { SEASON_HEADER_ICON_CLASS } from '../../../shared/components/seasonSymbolStyles.ts'
import { useTranslation } from '../../i18n'
import type { Course, CourseParticipantLimit } from '../types'
import { buildAlmaCourseUrl } from '../utils/almaUrl.ts'
import { getDetailSeasonTermType } from '../utils/catalogOffering.ts'
import { cleanCourseTitle, formatCourseTypeLabel, isGenericContentTitle } from '../utils/courseTitle.ts'
import { formatCourseLecturerName } from '../utils/lecturerName.ts'
import { buildIliasMetadataRows } from '../utils/illiasMetadata.ts'
import { buildLearningPlatformLinks } from '../utils/learningPlatformLinks.ts'
import { buildLinkedTextSegments, type TextLink } from '../utils/linkifyText.ts'
import { WeeklyScheduleMiniGrid } from './WeeklyScheduleMiniGrid'

const EMPTY_VALUES = new Set(['', '–', '-', 'tba', 'unknown', 'no registration period published'])

function hasValue(value: string | null | undefined): value is string {
  return Boolean(value) && !EMPTY_VALUES.has(value!.trim().toLowerCase())
}

function formatEcts(ects: number | null): string | null {
  if (ects === null) return null
  return Number.isInteger(ects) ? String(ects) : ects.toFixed(1)
}

function formatParticipantLimit(limit: CourseParticipantLimit): string | null {
  const label = hasValue(limit.title) ? limit.title : limit.groupType
  const prefix = hasValue(label) ? `${label}: ` : ''
  if (limit.minParticipants !== null && limit.maxParticipants !== null) {
    return `${prefix}${limit.minParticipants}-${limit.maxParticipants}`
  }
  if (limit.maxParticipants !== null) {
    return `${prefix}max. ${limit.maxParticipants}`
  }
  if (limit.minParticipants !== null) {
    return `${prefix}min. ${limit.minParticipants}`
  }
  return null
}

function formatParticipantLimits(limits: CourseParticipantLimit[] | undefined): string | null {
  const values = (limits ?? [])
    .map((limit) => formatParticipantLimit(limit))
    .filter((value): value is string => Boolean(value))
  return values.length > 0 ? values.join('; ') : null
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

function LinkedText({ text, links }: { text: string; links?: TextLink[] }) {
  return (
    <>
      {buildLinkedTextSegments(text, links).map((segment, index) =>
        segment.kind === 'link' ? (
          <a
            key={`${segment.url}-${index}`}
            href={segment.url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary hover:underline"
          >
            {segment.text}
          </a>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        ),
      )}
    </>
  )
}

function learningPlatformLabel(
  platform: string,
  labels: { moodle: string; ilias: string },
): string {
  const normalized = platform.trim().toLowerCase()
  if (normalized === 'moodle') return labels.moodle
  if (normalized === 'ilias') return labels.ilias
  return `Open ${platform}`
}

interface CourseDetailBodyProps {
  course: Course
  /** Rendered at the very bottom, e.g. add/remove plan actions. */
  footer?: ReactNode
}

/**
 * Shared course detail content for the catalog drawer, the detail route, and
 * the planner's centered detail modal. Only renders information that exists —
 * with the deliberate exception of the Moodle/ILIAS slot, which shows an
 * explicit empty state.
 */
export function CourseDetailBody({ course, footer }: CourseDetailBodyProps) {
  const { t } = useTranslation()
  const title = cleanCourseTitle(course.title, course.number)
  const learningPlatformLinks = buildLearningPlatformLinks(course.externalLinks, course.illias)
  const almaUrl = buildAlmaCourseUrl(course.detailUrl)
  const seasonTermType = getDetailSeasonTermType(course)
  const illiasRows = buildIliasMetadataRows(course.illias, {
    availability: t('courseDetail.illiasAvailability'),
    deadline: t('courseDetail.illiasDeadline'),
    instructors: t('courseDetail.illiasInstructors'),
    maxParticipants: t('courseDetail.illiasMaxParticipants'),
    registration: t('courseDetail.illiasRegistration'),
  })
  const hasIliasTitle =
    hasValue(course.illias?.title) && course.illias.title.trim() !== course.title.trim()
  const hasIliasDetails =
    Boolean(course.illias) &&
    (hasIliasTitle || illiasRows.length > 0 || hasValue(course.illias?.description))
  const learningPlatformLabels = {
    ilias: t('courseDetail.openIlias'),
    moodle: t('courseDetail.openMoodle'),
  }

  const factRows: Array<[string, string]> = []
  if (hasValue(course.number)) factRows.push([t('courseDetail.courseNumber'), course.number])
  if (hasValue(course.lecturer) || (course.lecturers?.length ?? 0) > 0) {
    factRows.push([t('courseDetail.lecturer'), formatCourseLecturerName(course)])
  }
  const ectsText = formatEcts(course.ects)
  if (ectsText) factRows.push(['ECTS', ectsText])
  if (course.sws !== null) factRows.push(['SWS', `${course.sws} SWS`])
  const participantLimitText = formatParticipantLimits(course.participantLimits)
  if (participantLimitText) factRows.push([t('courseDetail.participants'), participantLimitText])
  if (hasValue(course.language)) factRows.push([t('courseDetail.language'), course.language])
  if (hasValue(course.frequency)) factRows.push([t('courseDetail.frequency'), course.frequency])
  if (hasValue(course.registrationPeriod)) factRows.push([t('courseDetail.registration'), course.registrationPeriod!])

  const regulationOptions = (course.studyAreaOptions ?? []).filter(
    (option) => option.studyAreaCode,
  )

  return (
    <div className="min-w-0">
      <div className="relative mb-6 min-w-0 rounded-[14px] border border-border bg-surface px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <TypePill label={formatCourseTypeLabel(course.types)} />
            </div>

            <h1 className="break-words font-serif text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg sm:text-[22px]">
              {title}
            </h1>

            {(course.offeredPeriods?.length ?? 0) > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
          <SeasonSymbol termType={seasonTermType} className={SEASON_HEADER_ICON_CLASS} tone="seasonal" />
        </div>
      </div>

      <Section title={t('courseDetail.weeklySchedule')}>
        <WeeklyScheduleMiniGrid schedule={course.schedule} />
      </Section>

      {hasValue(course.description) ? (
        <Section title={t('courseDetail.description')}>
          <p className="whitespace-pre-wrap text-[13.5px] leading-7 text-fg-mid">
            <LinkedText text={course.description} links={course.descriptionLinks} />
          </p>
        </Section>
      ) : null}

      {course.contents && course.contents.length > 0 ? (
        <Section title={t('courseDetail.contents')}>
          <div className="flex min-w-0 flex-col gap-4">
            {course.contents.map((section, index) => (
              <div key={`${section.title}-${index}`} className="min-w-0">
                {isGenericContentTitle(section.title) ? null : (
                  <div className="mb-1 text-[12.5px] font-semibold text-fg">{section.title}</div>
                )}
                <p className="whitespace-pre-wrap break-words text-[13.5px] leading-7 text-fg-mid">
                  <LinkedText text={section.text} links={section.links} />
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title={t('courseDetail.learningPlatforms')}>
        <div className="grid gap-2.5">
          {learningPlatformLinks.length > 0 ? (
            learningPlatformLinks.map((link) => (
              <div key={`${link.platform}-${link.url}`} className="flex min-w-0 flex-wrap items-center gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center rounded-full border border-primary/30 bg-primary-soft px-3 py-1.5 text-[12.5px] font-semibold text-primary hover:underline"
                >
                  <span className="truncate">
                    {learningPlatformLabel(link.platform, learningPlatformLabels)}
                  </span>
                </a>
                {hasValue(link.label) ? (
                  <span className="min-w-0 break-words text-[12px] text-fg-muted">
                    {link.label}
                  </span>
                ) : null}
              </div>
            ))
          ) : (
            <div className="text-[13px] text-fg-muted">{t('courseDetail.noLearningLink')}</div>
          )}
        </div>
      </Section>

      {hasIliasDetails && course.illias ? (
        <Section title={t('courseDetail.illias')}>
          <div className="grid gap-3">
            {hasIliasTitle ? (
              <div className="min-w-0 break-words text-[12.5px] text-fg-muted">
                {course.illias.title}
              </div>
            ) : null}

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

      {course.prerequisites.length > 0 ? (
        <Section title={t('courseDetail.prerequisites')}>
          <ul className="flex flex-col gap-1.5">
            {course.prerequisites.map((prerequisite) => (
              <li
                key={prerequisite}
                className="flex items-baseline gap-2.5 text-[13.5px] text-fg-mid"
              >
                <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>
                  <LinkedText text={prerequisite} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {factRows.length > 0 ? (
        <Section title={t('courseDetail.facts')}>
          <div className="grid gap-1.5">
            {factRows.map(([key, value]) => (
              <div
                key={key}
                className="grid min-w-0 grid-cols-[minmax(4.5rem,7rem)_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 text-[12.5px] sm:grid-cols-[minmax(6rem,8.5rem)_minmax(0,1fr)]"
              >
                <span className="min-w-0 break-words font-medium text-fg-muted">{key}</span>
                <span className="min-w-0 break-words text-fg">{value}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {almaUrl ? (
        <Section title={t('courseDetail.links')}>
          <div className="grid gap-2 text-[13px]">
            <a href={almaUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {t('courseDetail.openAlma')}
            </a>
          </div>
        </Section>
      ) : null}

      {/* Deliberately the last informational block: the header no longer
          repeats the study-area mapping, so it lives only here. */}
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

      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  )
}
