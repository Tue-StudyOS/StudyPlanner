import type { CourseExternalLink, CourseIliasMetadata } from '../types.ts'

const LEARNING_PLATFORMS = new Set(['moodle', 'ilias'])

function normalizePlatform(platform: string | null | undefined): string {
  return (platform ?? '').trim().toLowerCase()
}

function linkKey(link: CourseExternalLink): string {
  return `${normalizePlatform(link.platform)}:${link.url.trim()}`
}

export function isLearningPlatformLink(link: CourseExternalLink): boolean {
  return LEARNING_PLATFORMS.has(normalizePlatform(link.platform)) && Boolean(link.url.trim())
}

export function buildLearningPlatformLinks(
  externalLinks: CourseExternalLink[] | undefined,
  illiasMetadata: CourseIliasMetadata | null | undefined,
): CourseExternalLink[] {
  const links: CourseExternalLink[] = []
  const seen = new Set<string>()

  for (const link of externalLinks ?? []) {
    if (!isLearningPlatformLink(link)) continue
    const key = linkKey(link)
    if (seen.has(key)) continue
    seen.add(key)
    links.push(link)
  }

  if (illiasMetadata?.url?.trim()) {
    const metadataLink: CourseExternalLink = {
      platform: 'ilias',
      url: illiasMetadata.url,
      label: illiasMetadata.title || 'Open ILIAS course',
    }
    const key = linkKey(metadataLink)
    if (!seen.has(key)) {
      links.push(metadataLink)
    }
  }

  return links
}
