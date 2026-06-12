import { useTranslation } from '../../i18n'
import { useOnboarding } from '../hooks/useOnboarding'
import { HelpIcon } from './icons'

interface HelpButtonProps {
  className?: string
}

export function HelpButton({ className = '' }: HelpButtonProps) {
  const { open } = useOnboarding()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('help.open')}
      data-tour="reopen-tour"
      className={`flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-sidebar-hover text-white/80 transition-colors hover:text-white ${className}`}
    >
      <HelpIcon />
    </button>
  )
}
