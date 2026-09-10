import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { PageShell } from '../../../shared/components/PageShell.tsx'
import { ROUTES } from '../../routes.ts'
import { OperatorContact } from './OperatorContact.tsx'

export function ImprintPage(): JSX.Element {
  return (
    <PageShell width="narrow" className="grid min-w-0 gap-6 break-words pb-12 text-[13px] leading-6 text-fg-mid">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold text-fg">Impressum</h1>
        <p>StudyPlanner · Ein unabhängiges studentisches Projekt</p>
      </header>

      <section className="grid min-w-0 gap-3 rounded-[12px] border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-fg">Angaben zum Diensteanbieter</h2>
        <OperatorContact />
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">Über das Projekt</h2>
        <p>
          StudyPlanner wird von einer Gruppe Studierender unabhängig von der Hochschule
          betrieben. Es ist kein offizielles Angebot der Universität. Das Projekt ist
          kostenlos und verfolgt keine Werbe- oder Verkaufszwecke.
        </p>
      </section>

      <p>
        Informationen zum Umgang mit deinen Daten und zu deinen Rechten findest du in der{' '}
        <Link className="underline underline-offset-4 hover:text-fg" to={ROUTES.privacy}>
          Datenschutzerklärung
        </Link>.
      </p>
    </PageShell>
  )
}
