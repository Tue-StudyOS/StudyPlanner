import { TEST_ROUTES } from '../../routes'
import { useTranslation } from '../../i18n'
import { BoxCard, BoxGrid } from './BoxCard'
import { RevealItem } from './RevealItem'

export function TestLanding() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
      <BoxGrid>
        <RevealItem index={0}>
          <BoxCard to={TEST_ROUTES.catalog} title={t('test.catalog.title')} />
        </RevealItem>
        <RevealItem index={1}>
          <BoxCard to={TEST_ROUTES.personal} title={t('test.personal.title')} />
        </RevealItem>
      </BoxGrid>
    </div>
  )
}
