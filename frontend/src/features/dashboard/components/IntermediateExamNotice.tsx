import type { IntermediateExamStatus } from '../types'

interface IntermediateExamNoticeProps {
  status: IntermediateExamStatus
}

export function IntermediateExamNotice({ status }: IntermediateExamNoticeProps) {
  return (
    <div className="rounded-[10px] border border-[#d4a800]/40 bg-[#fffbeb] dark:border-[#7a6000]/50 dark:bg-[#1c1600]/40 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-[#b08000] dark:text-[#e0a800]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-fg">Zwischenprüfungsanforderung ausstehend</p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Bis Ende des 4. Semesters muss je eine bestandene Prüfungsleistung aus beiden Bereichen vorliegen.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {status.qualifyingGroups.map((group) => (
              <div
                key={group.code}
                className={`flex min-w-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium ${
                  group.isFulfilled
                    ? 'border-[#86c99a] bg-[#e8f5ec] text-[#1e7b3a] dark:border-[#2d6b3f] dark:bg-[#0f2e1a] dark:text-[#5dd880]'
                    : 'border-[#d4a800]/50 bg-[#fef9e7] text-[#7a5c00] dark:border-[#7a6000]/60 dark:bg-[#1c1600] dark:text-[#c8a800]'
                }`}
              >
                {group.isFulfilled ? (
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="min-w-0 truncate">{group.name}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
