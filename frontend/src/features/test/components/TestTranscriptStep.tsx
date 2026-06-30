import { Transcript } from '../../transcript/components/Transcript'
import { useTranslation } from '../../i18n'

// First-run transcript step: reuses the full transcript upload/review/import
// surface and frames it with skip / continue so onboarding can move on.
export function TestTranscriptStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="w-full">
      <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-2 px-4 pt-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-fg">{t('test.transcript.title')}</h1>
            <p className="text-[13.5px] text-fg-muted">{t('test.transcript.subtitle')}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onDone}
              className="rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-fg-mid transition-colors hover:bg-surface-hover"
            >
              {t('test.transcript.skip')}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('test.transcript.continue')}
            </button>
          </div>
        </div>
      </div>
      <Transcript />
    </div>
  )
}
