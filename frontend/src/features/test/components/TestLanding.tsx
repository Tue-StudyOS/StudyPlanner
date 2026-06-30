import { TEST_ROUTES } from '../../routes'
import { useTranslation } from '../../i18n'
import { BoxCard, BoxGrid } from './BoxCard'
import { RevealItem } from './RevealItem'

export function TestLanding() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-18">
      <BoxGrid>
        <RevealItem index={0}>
          <BoxCard
            to={TEST_ROUTES.catalog}
            title={t('test.catalog.title')}
            description={t('test.catalog.desc')}
            tone="catalog"
          />
        </RevealItem>
        <RevealItem index={1}>
          <BoxCard
            to={TEST_ROUTES.personal}
            title={t('test.personal.title')}
            description={t('test.personal.desc')}
            tone="personal"
          />
        </RevealItem>
      </BoxGrid>
    </div>
  )
}
