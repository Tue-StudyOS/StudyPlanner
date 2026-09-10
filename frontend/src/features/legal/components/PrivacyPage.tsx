import type { JSX } from 'react'
import { PageShell } from '../../../shared/components/PageShell.tsx'
import { OperatorContact } from './OperatorContact.tsx'

export function PrivacyPage(): JSX.Element {
  return (
    <PageShell width="narrow" className="grid min-w-0 gap-6 break-words pb-12 text-[13px] leading-6 text-fg-mid">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold text-fg">Datenschutzerklärung</h1>
        <p>Stand: 10. September 2026</p>
        <p>So geht StudyPlanner mit Account-, Planungs- und Nutzungsdaten um.</p>
      </header>

      <section className="grid min-w-0 gap-3 rounded-[12px] border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-fg">1. Verantwortlicher und Kontakt</h2>
        <OperatorContact />
        <p>StudyPlanner ist ein unabhängiges, nicht-kommerzielles studentisches Projekt.</p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">2. Account und Studienplanung</h2>
        <p>
          Für deinen Account verarbeiten wir Nutzername, E-Mail-Adresse, Passwort-Hash
          und Kontoeinstellungen. Für die Planung speichern wir deine Favoriten,
          Semesterpläne, belegten und abgeschlossenen Kurse, Noten sowie gespeicherte
          Import- und Prüfungsdaten. Die erforderlichen Accountdaten ermöglichen die
          Anmeldung; ohne sie können wir keinen Account bereitstellen. Du entscheidest,
          welche Studien- und Prüfungsdaten du einträgst.
        </p>
        <p>
          Ein ausgewähltes Transcript-PDF wird im Browser gelesen. Übernommene
          Studienleistungen und gespeicherte Importprobleme werden an die API gesendet.
          Die daraus übernommenen Daten bleiben also nicht ausschließlich auf deinem Gerät.
        </p>
        <p>
          Diese Verarbeitung dient der von dir angeforderten Account- und Planungsfunktion
          (Art. 6 Abs. 1 lit. b DSGVO).
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">3. Kurskatalog, Bewertungen und Feedback</h2>
        <p>
          Der Kurskatalog beruht auf Angaben aus ALMA. Dazu gehören Namen von Lehrpersonen
          und ihre Zuordnung zu Lehrveranstaltungen. Diese Informationen helfen bei der
          Semesterplanung. Auch öffentlich zugängliche Angaben können personenbezogen sein.
        </p>
        <p>
          Kursbewertungen enthalten Bewertung, Kommentar, Semester und gegebenenfalls
          eine Lehrperson. Sie erscheinen öffentlich ohne deinen Nutzernamen, bleiben
          intern aber deinem Account zugeordnet. Eine vollständige Anonymität besteht
          deshalb nicht. Bitte veröffentliche keine privaten Kontaktdaten oder vertraulichen
          Angaben über andere Personen.
        </p>
        <p>
          Neues Produktfeedback übermittelt nur Bewertung und Nachricht, ohne
          Login-Cookie, Referrer oder Seitenroute. Es wird ohne Accountverknüpfung
          gespeichert; dein Nachrichtentext kann dich trotzdem identifizierbar machen.
          Hosting und Missbrauchsschutz verarbeiten weiterhin technische Verbindungsdaten.
          Ältere Feedbackeinträge können noch eine Seitenroute enthalten.
          Nutze für Datenschutzanfragen den Kontakt in Abschnitt 1.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">4. Sicherheit und Fehlerdiagnose</h2>
        <p>
          Zur Fehlerbehebung erfassen wir Route, Fehlerart, Status, technische Details
          und bei angemeldeten Personen vorübergehend den Nutzernamen. Filter kürzen
          URLs und entfernen typische Zugangsdaten und personenbezogene Inhalte aus
          Diagnosefeldern; sie können nicht jeden Freitext zuverlässig anonymisieren.
        </p>
        <p>
          Anfragelimits verwenden Hashwerte von IP-Adressen oder Accountkennungen und
          Zeitfenster. Diese Werte sind pseudonymisiert, nicht anonym. Sicherheitsmaßnahmen
          und begrenzte Diagnose dienen unserem berechtigten Interesse an einem sicheren,
          funktionsfähigen Dienst (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">5. Cookies und Browser-Speicher</h2>
        <p>
          Ein HttpOnly-Session-Cookie hält dich angemeldet, normalerweise für bis zu
          30 Tage. Local Storage merkt von dir gewählte Einstellungen wie Theme, Layout
          und eingeklappte Bereiche; voreingestellte Werte werden nicht automatisch
          gespeichert. Session Storage sichert Zwischenstände eines von dir gestarteten
          Transcript-Imports und verhindert wiederholtes Neuladen nach einem Update.
          API-Caches, lokale Diagnosen und der Semester-Hinweis bleiben nur im Arbeitsspeicher
          der geöffneten Seite. Private Daten werden beim Abmelden oder Kontowechsel
          bereinigt; gewählte Anzeigeeinstellungen bleiben erhalten.
        </p>
        <p>
          Die Anwendung bindet keine Werbung oder Analyse-Tracker ein. Schriftarten
          werden lokal ausgeliefert. Für technisch notwendige Speicherung gilt die
          Ausnahme des § 25 Abs. 2 TDDDG.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">6. Hosting und Empfänger</h2>
        <p>
          Die bereitgestellte Website nutzt Cloudflare Pages, Workers und D1 für
          Oberfläche, API und Datenbank. Dabei verarbeitet Cloudflare Verbindungsdaten
          und gespeicherte Anwendungsdaten. Zusätzlich sind technische Betriebslogs
          aktiviert; diese sind von der Fehlerdiagnose innerhalb der Anwendung getrennt.
          Berechtigte Projektmitglieder können Daten für Betrieb und Support einsehen.
        </p>
        <p>
          Cloudflare beschreibt auch Verarbeitung außerhalb des Europäischen
          Wirtschaftsraums und vertragliche Schutzmaßnahmen in seinen{' '}
          <a className="underline underline-offset-4 hover:text-fg" href="https://www.cloudflare.com/cloudflare-customer-dpa/">
            Datenschutzbedingungen
          </a>. Eine ausschließliche Speicherung in Deutschland wird hier nicht zugesichert.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">7. Speicherdauer</h2>
        <p>
          Account- und Planungsdaten bleiben grundsätzlich bis zur Kontolöschung
          gespeichert. Dabei werden auch die zugehörigen Bewertungen entfernt.
          Die Anwendung bereinigt Diagnosen älter als 14 Tage beim Eingang oder Abruf
          von Diagnosen und begrenzt sie auf 500 Einträge. Feedback älter als sechs
          Monate wird bei einer neuen Feedback-Einsendung entfernt. Abgelaufene
          Rate-Limit-Fenster werden bei späteren entsprechenden Anfragen bereinigt.
        </p>
        <p>
          Bei ausbleibenden Anfragen können diese Daten länger bestehen bleiben.
          Betriebslogs und Sicherungen bei Cloudflare haben eigene Aufbewahrungsfristen.
          Eine Kontolöschung entfernt Daten nicht sofort aus vorhandenen Sicherungen.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">8. Deine Rechte</h2>
        <p>
          Du kannst Auskunft, Berichtigung, Löschung, Einschränkung und
          Datenübertragbarkeit verlangen, soweit die jeweiligen Voraussetzungen gelten.
          Bei Verarbeitung aufgrund berechtigter Interessen kannst du aus Gründen
          deiner besonderen Situation widersprechen. Im Account kannst du deine
          Zugangsdaten ändern und dein Konto selbst löschen.
        </p>
        <p>
          Der Kontakt in Abschnitt 1 ist für Anfragen und Hinweise zu personenbezogenen
          Daten vorgesehen. Bitte sende keine Passwörter oder vollständigen
          Ausweisdokumente. Eine Anmeldung oder Produktbewertung ist dafür nicht erforderlich.
          Du hast außerdem das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren.
        </p>
      </section>
    </PageShell>
  )
}
