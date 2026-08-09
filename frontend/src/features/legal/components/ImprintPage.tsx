import { PageShell } from '../../../shared/components/PageShell.tsx'

export function ImprintPage() {
  return (
    <PageShell width="narrow" className="grid min-w-0 gap-6 pb-12 text-[13px] leading-6 text-fg-mid">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold text-fg">Impressum</h1>
        <p>Angaben für das nicht-kommerzielle studentische Projekt StudyPlanner.</p>
      </header>

      <section className="rounded-[12px] border border-primary/30 bg-primary-soft p-4">
        <h2 className="font-semibold text-fg">Entwicklungsplatzhalter</h2>
        <p>Die folgenden Angaben müssen vor einem öffentlichen Produktivbetrieb durch echte Betreiberangaben ersetzt werden.</p>
      </section>

      <section className="grid gap-2 rounded-[12px] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-fg">Diensteanbieter</h2>
        <p>
          [VOLLSTÄNDIGER NAME DER VERANTWORTLICHEN PERSON]<br />
          [STRASSE UND HAUSNUMMER]<br />
          [POSTLEITZAHL UND ORT]<br />
          [LAND]
        </p>
        <p>E-Mail: [KONTAKT-E-MAIL]</p>
      </section>

      <p>
        Weitere Unternehmens-, Register-, Umsatzsteuer-, Datenschutzbeauftragten- oder
        Hochschulangaben werden erst ergänzt, wenn sie für den tatsächlichen Betreiber
        rechtlich und sachlich zutreffen.
      </p>
    </PageShell>
  )
}
