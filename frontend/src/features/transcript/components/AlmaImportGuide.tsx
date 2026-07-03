import { useState } from 'react'
import { DetailSheet } from '../../../shared/components/DetailSheet'
import { CloseIcon } from '../../../shared/components/icons'
import { useTranslation } from '../../i18n'

// A browser cannot read the user's downloads directly, so this guide walks the
// user to the ALMA Transcript-of-Records export and then hands them straight to
// the existing file picker to drop the downloaded PDF in.
const ALMA_URL = 'https://alma.uni-tuebingen.de/'

export function AlmaImportGuide({ onChooseFile }: { onChooseFile: () => void }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const header = (
    <div className="flex items-start justify-between gap-4 px-6 py-5">
      <h3 id="alma-guide-title" className="text-[18px] font-semibold text-fg">
        {t('transcript.almaGuideTitle')}
      </h3>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        aria-label="Close"
        className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <CloseIcon size={18} />
      </button>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-hover"
      >
        {t('transcript.almaGuideOpen')}
      </button>

      {isOpen ? (
        <DetailSheet onClose={() => setIsOpen(false)} header={header} labelledBy="alma-guide-title">
          <div className="grid gap-4 px-6 py-5">
            <ol className="grid list-decimal gap-2 pl-5 text-[13.5px] leading-6 text-fg-mid">
              <li>{t('transcript.almaStep1')}</li>
              <li>{t('transcript.almaStep2')}</li>
              <li>{t('transcript.almaStep3')}</li>
            </ol>
            <p className="text-[12.5px] text-fg-muted">{t('transcript.almaNote')}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={ALMA_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
              >
                {t('transcript.almaOpen')}
              </a>
              <button
                type="button"
                onClick={() => {
                  onChooseFile()
                  setIsOpen(false)
                }}
                className="rounded-md border border-border px-3.5 py-2 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-hover"
              >
                {t('transcript.almaChooseFile')}
              </button>
            </div>
          </div>
        </DetailSheet>
      ) : null}
    </>
  )
}
