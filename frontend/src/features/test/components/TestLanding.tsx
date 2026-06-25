import { TEST_ROUTES } from '../../routes'
import { useTranslation } from '../../i18n'
import { BoxCard, BoxGrid } from './BoxCard'
import { RevealItem } from './RevealItem'

export function TestLanding() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <RevealItem index={0}>
        <p className="mb-6 text-center text-[13px] text-fg-muted">{t('test.landing.subtitle')}</p>
      </RevealItem>
      <BoxGrid>
        <RevealItem index={1}>
          <BoxCard to={TEST_ROUTES.catalog} title={t('test.catalog.title')} description={t('test.catalog.desc')} />
        </RevealItem>
        <RevealItem index={2}>
          <BoxCard to={TEST_ROUTES.personal} title={t('test.personal.title')} description={t('test.personal.desc')} />
        </RevealItem>
      </BoxGrid>
    </div>
  )
}
