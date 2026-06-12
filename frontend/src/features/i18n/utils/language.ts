import { TRANSLATIONS, type TranslationKey } from '../translations.ts'
import type { SupportedLanguage } from '../types.ts'

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage | null {
  if (!value) return null
  const normalizedValue = value.trim().toLowerCase()
  if (normalizedValue === 'de' || normalizedValue.startsWith('de-')) return 'de'
  if (normalizedValue === 'en' || normalizedValue.startsWith('en-')) return 'en'
  return null
}

export function getBrowserLanguage(navigatorLanguage?: string): SupportedLanguage {
  if (navigatorLanguage) return normalizeLanguage(navigatorLanguage) ?? DEFAULT_LANGUAGE
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  const candidates = [window.navigator.language, ...(window.navigator.languages ?? [])]
  for (const candidate of candidates) {
    const language = normalizeLanguage(candidate)
    if (language) return language
  }
  return DEFAULT_LANGUAGE
}

export function resolveAppLanguage(
  preferredLanguage: string | null | undefined,
  navigatorLanguage?: string,
): SupportedLanguage {
  return normalizeLanguage(preferredLanguage) ?? getBrowserLanguage(navigatorLanguage)
}

export function translate(
  language: SupportedLanguage,
  key: TranslationKey,
  replacements: Record<string, string | number> = {},
): string {
  const template: string = TRANSLATIONS[language][key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key]
  return Object.entries(replacements).reduce<string>(
    (text, [replacementKey, replacementValue]) =>
      text.replaceAll(`{${replacementKey}}`, String(replacementValue)),
    template,
  )
}

export function createTranslator(language: SupportedLanguage): (
  key: TranslationKey,
  replacements?: Record<string, string | number>,
) => string {
  return (key, replacements = {}) => translate(language, key, replacements)
}
