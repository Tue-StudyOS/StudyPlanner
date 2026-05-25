import type { RegulationAreaOption } from '../../../shared/utils/regulation'

interface StudyAreaAssignmentFieldProps {
  value: string | null
  options: RegulationAreaOption[]
  locked: boolean
  disabled?: boolean
  label?: string
  helpText?: string
  tone?: 'default' | 'error'
  size?: 'default' | 'compact'
  onChange: (studyAreaCode: string) => void
}

function wrapperClasses(tone: 'default' | 'error'): string {
  return tone === 'error'
    ? 'border-rose-200 bg-rose-50/60'
    : 'border-border-light bg-surface-hover/25'
}

function selectClasses(tone: 'default' | 'error', size: 'default' | 'compact'): string {
  return [
    'w-full rounded-md border bg-surface text-fg outline-none disabled:cursor-not-allowed disabled:opacity-60',
    tone === 'error' ? 'border-rose-300 focus:border-rose-500' : 'border-border focus:border-primary',
    size === 'compact' ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[12.5px]',
  ].join(' ')
}

export function StudyAreaAssignmentField({
  value,
  options,
  locked,
  disabled,
  label = 'Regulation area',
  helpText,
  tone = 'default',
  size = 'default',
  onChange,
}: StudyAreaAssignmentFieldProps) {
  const selectedOption = options.find((option) => option.code === value) ?? options[0] ?? null
  const compact = size === 'compact'

  return (
    <div className={`grid gap-1.5 rounded-[10px] border px-3 py-3 ${wrapperClasses(tone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            {label}
          </div>
          {helpText ? (
            <p className={`mt-1 ${tone === 'error' ? 'text-rose-700' : 'text-fg-muted'} ${compact ? 'text-[11.5px]' : 'text-[12px]'}`}>
              {helpText}
            </p>
          ) : null}
        </div>
        {selectedOption ? (
          <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            {selectedOption.shortLabel}
          </span>
        ) : null}
      </div>

      {options.length === 0 ? (
        <div className={`rounded-lg border border-dashed px-3 py-2.5 ${tone === 'error' ? 'border-rose-300 text-rose-700' : 'border-border text-fg-muted'} ${compact ? 'text-[12px]' : 'text-[12.5px]'}`}>
          No compatible regulation areas are available for the current selection.
        </div>
      ) : locked && selectedOption ? (
        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <div className={`${compact ? 'text-[12.5px]' : 'text-[13px]'} font-semibold text-fg`}>
            {selectedOption.label}
          </div>
          <div className="text-[11.5px] text-fg-muted">Fixed by the active examination regulation</div>
        </div>
      ) : (
        <select
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={selectClasses(tone, size)}
        >
          <option value="">Select a regulation area</option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
