import { TEST_ROUTES } from '../../routes'
import { useTranslation } from '../../i18n'
import { BoxCard, BoxGrid } from './BoxCard'
import { RevealItem } from './RevealItem'

// Logged-in entry point: choose between degree progress and the semester planner.
export function TestPersonalHub() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <BoxGrid>
        <RevealItem index={0}>
          <BoxCard to={TEST_ROUTES.progress} title={t('nav.progress')} description={t('test.hub.progressDesc')} />
        </RevealItem>
        <RevealItem index={1}>
          <BoxCard to={TEST_ROUTES.semesters} title={t('test.semesters.title')} description={t('test.semesters.desc')} />
        </RevealItem>
      </BoxGrid>
    </div>
  )
}
