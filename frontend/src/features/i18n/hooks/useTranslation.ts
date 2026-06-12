import { useMemo } from 'react'
import { useAuth } from '../../auth'
import type { TranslationKey } from '../translations'
import type { SupportedLanguage } from '../types'
import { createTranslator, resolveAppLanguage } from '../utils/language'

export function useTranslation(): {
  language: SupportedLanguage
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string
} {
  const { user } = useAuth()
  const language = resolveAppLanguage(user?.profile.appLanguage)
  const t = useMemo(() => createTranslator(language), [language])
  return { language, t }
}
