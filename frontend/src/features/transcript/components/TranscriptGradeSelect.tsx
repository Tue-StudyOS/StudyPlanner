import { TRANSCRIPT_GRADE_VALUES, formatOptionalTranscriptGrade } from '../utils/grades'

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
    <select
      value={formatOptionalTranscriptGrade(value)}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className={className}
    >
      <option value="">No grade</option>
      {TRANSCRIPT_GRADE_VALUES.map((grade) => (
        <option key={grade} value={grade.toFixed(1)}>
          {grade.toFixed(1)}
        </option>
      ))}
    </select>
  )
}
