import { formatOptionalTranscriptGrade } from '../utils/grades'

interface TranscriptGradeSelectProps {
  value: number | null
  className: string
  onChange: (value: number | null) => void
}

export function TranscriptGradeSelect({
  value,
  className,
  onChange,
}: TranscriptGradeSelectProps) {
  return (
    <input
      type="number"
      min="1"
      max="4"
      step="0.01"
      inputMode="decimal"
      value={formatOptionalTranscriptGrade(value)}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className={className}
      aria-label="Module grade from 1.00 to 4.00"
    />
  )
}
