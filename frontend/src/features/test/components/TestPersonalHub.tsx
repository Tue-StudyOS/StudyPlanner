import { TEST_ROUTES } from '../../routes'
import { useTranslation } from '../../i18n'
import { BoxCard, BoxGrid } from './BoxCard'
import { RevealItem } from './RevealItem'

export function TestPersonalHub() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
      <BoxGrid>
        <RevealItem index={0}>
          <BoxCard to={TEST_ROUTES.progress} title={t('nav.progress')} />
        </RevealItem>
        <RevealItem index={1}>
          <BoxCard to={TEST_ROUTES.semesters} title={t('test.semesters.title')} />
        </RevealItem>
      </BoxGrid>
    </div>
  )
}
