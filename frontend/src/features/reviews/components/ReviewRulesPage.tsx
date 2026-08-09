import { PageShell } from '../../../shared/components/PageShell.tsx'
import { useTranslation } from '../../i18n'

export function ReviewRulesPage() {
  const { t } = useTranslation()

  return (
    <PageShell width="narrow" className="grid min-w-0 gap-5 pb-12">
      <header className="grid min-w-0 gap-2">
        <h1 className="break-words text-2xl font-semibold text-fg">{t('reviews.rulesPageTitle')}</h1>
        <p className="break-words text-[13px] leading-6 text-fg-mid">{t('reviews.rulesPageIntro')}</p>
      </header>
      <section className="grid min-w-0 gap-3 rounded-[12px] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-fg">{t('reviews.rulesTitle')}</h2>
        <ul className="grid list-disc gap-2 pl-5 text-[13px] leading-6 text-fg-mid">
          <li>{t('reviews.rulesRelevant')}</li>
          <li>{t('reviews.rulesProhibited')}</li>
          <li>{t('reviews.rulesModeration')}</li>
        </ul>
      </section>
      <section id="redress" className="grid min-w-0 gap-2 rounded-[12px] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-fg">{t('reviews.rulesRedressTitle')}</h2>
        <p className="break-words text-[13px] leading-6 text-fg-mid">{t('reviews.rulesRedressBody')}</p>
      </section>
    </PageShell>
  )
}
