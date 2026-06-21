import type { CourseIliasMetadata } from '../types.ts'

export interface IliasMetadataLabels {
  availability: string
  deadline: string
  instructors: string
  maxParticipants: string
  registration: string
}

export interface IliasMetadataRow {
  key: keyof IliasMetadataLabels
  label: string
  value: string
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim())
}

export function buildIliasMetadataRows(
  metadata: CourseIliasMetadata | null | undefined,
  labels: IliasMetadataLabels,
): IliasMetadataRow[] {
  if (!metadata) return []

  const rows: IliasMetadataRow[] = []
  if (hasText(metadata.registration)) {
    rows.push({ key: 'registration', label: labels.registration, value: metadata.registration })
  }
  if (hasText(metadata.deadline)) {
    rows.push({ key: 'deadline', label: labels.deadline, value: metadata.deadline })
  }
  if (typeof metadata.maxParticipants === 'number') {
    rows.push({
      key: 'maxParticipants',
      label: labels.maxParticipants,
      value: String(metadata.maxParticipants),
    })
  }
  if (hasText(metadata.availability)) {
    rows.push({ key: 'availability', label: labels.availability, value: metadata.availability })
  }
  if ((metadata.instructors ?? []).length > 0) {
    rows.push({
      key: 'instructors',
      label: labels.instructors,
      value: metadata.instructors!.join(', '),
    })
  }
  return rows
}

export function hasIliasMetadata(metadata: CourseIliasMetadata | null | undefined): metadata is CourseIliasMetadata {
  return Boolean(
    metadata?.url ||
      metadata?.description?.trim() ||
      metadata?.registration?.trim() ||
      metadata?.deadline?.trim() ||
      typeof metadata?.maxParticipants === 'number',
  )
}
