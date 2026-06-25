import { useParams } from 'react-router-dom'
import { useTranslation } from '../../i18n'
import { formatSemesterLabelShort } from '../../planner/utils/semesterLabels'
import { testSemesterPath } from '../../routes'
import { BoxCard, BoxGrid } from './BoxCard'
import { RequireTestAuth } from './RequireTestAuth'
import { RevealItem } from './RevealItem'

function SemesterDetailInner() {
  const { label = '' } = useParams<{ label: string }>()
  const { t } = useTranslation()
  const shortLabel = formatSemesterLabelShort(label)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <RevealItem index={0}>
        <h1 className="mb-6 text-center text-[20px] font-semibold text-fg">{shortLabel}</h1>
      </RevealItem>
      <BoxGrid>
        <RevealItem index={1}>
          <BoxCard
            to={testSemesterPath(label, '/plan')}
            title={t('test.detail.scheduleTitle')}
            description={t('test.detail.scheduleDesc')}
          />
        </RevealItem>
        <RevealItem index={2}>
          <BoxCard
            to={testSemesterPath(label, '/editor')}
            title={t('test.detail.editorTitle')}
            description={t('test.detail.editorDesc')}
          />
        </RevealItem>
      </BoxGrid>
    </div>
  )
}

export function TestSemesterDetail() {
  return (
    <RequireTestAuth>
      <SemesterDetailInner />
    </RequireTestAuth>
  )
}
