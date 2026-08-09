import { PageShell } from '../../../shared/components/PageShell.tsx'

export function PrivacyPage() {
  return (
    <PageShell width="narrow" className="grid min-w-0 gap-6 pb-12 text-[13px] leading-6 text-fg-mid">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold text-fg">Datenschutzerklärung</h1>
        <p>Stand: 9. August 2026</p>
      </header>

      <section className="rounded-[12px] border border-primary/30 bg-primary-soft p-4">
        <h2 className="font-semibold text-fg">Vor dem Produktivbetrieb vervollständigen</h2>
        <p>
          Verantwortliche Person, ladungsfähige Anschrift und eine überwachte Kontakt-E-Mail
          fehlen noch. Datenschutzanfragen können während der Entwicklung über den
          Feedback-Button gesendet werden.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">1. Verantwortlicher und Kontakt</h2>
        <p>
          [NAME DER VERANTWORTLICHEN PERSON], [POSTANSCHRIFT], E-Mail: [KONTAKT-E-MAIL].
          StudyPlanner ist ein nicht-kommerzielles studentisches Projekt.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">2. Welche Daten wir verarbeiten</h2>
        <ul className="grid list-disc gap-2 pl-5">
          <li><strong>Account:</strong> Nutzername, E-Mail-Adresse, Passwort-Hash und Kontoeinstellungen für Anmeldung und Kontoverwaltung.</li>
          <li><strong>Studienplanung:</strong> Favoriten, Semesterpläne, belegte oder abgeschlossene Kurse, Noten und importierte Prüfungsdaten für die von dir genutzten Planungsfunktionen.</li>
          <li><strong>Bewertungen:</strong> Bewertung, Kommentar, Semester und optional die Lehrperson. Bewertungen erscheinen öffentlich ohne Nutzernamen, bleiben intern aber dem Account zugeordnet. Frei eingegebene Namen können personenbezogene Daten sein.</li>
          <li><strong>Feedback:</strong> Bewertung, Nachricht und die aktuelle Seitenroute. Feedback ist nicht mit einem Account verknüpft.</li>
          <li><strong>Diagnose:</strong> gekürzte Route, Fehlerart, Status und technische Details; bei angemeldeten Personen vorübergehend der Nutzername. Zugangsdaten, Cookies, Token, E-Mail-Adressen und offensichtliche Studieninhalte werden aus Diagnosefeldern entfernt.</li>
          <li><strong>Missbrauchsschutz:</strong> nicht rückrechenbare Hashwerte und kurze Zeitfenster für Login- und Anfragelimits.</li>
        </ul>
        <p>
          Die Verarbeitung ist nötig, um die angeforderten Funktionen bereitzustellen und den
          Dienst sicher und funktionsfähig zu halten (Art. 6 Abs. 1 lit. b bzw. f DSGVO).
          Wir verwenden derzeit keine Werbung, Reichweitenanalyse oder Tracking-Pixel.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">3. Browser-Speicher und Cookies</h2>
        <p>
          Ein technisch notwendiges, HttpOnly-geschütztes Session-Cookie hält dich angemeldet.
          Local Storage merkt UI-Einstellungen wie Theme und Layout. Session Storage enthält
          kurzzeitig nutzerbezogene API-Caches, einen Import-Zwischenstand und lokale
          Fehlerdiagnosen. Private Session-Daten werden beim Abmelden oder Kontowechsel
          gelöscht. Da aktuell nur notwendige Speicherung verwendet wird, gibt es keinen
          Cookie-Banner.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">4. Hosting und Empfänger</h2>
        <p>
          Die Oberfläche läuft auf Cloudflare Pages, die API auf Cloudflare Workers und die
          Datenbank auf Cloudflare D1. Cloudflare verarbeitet dabei technische
          Verbindungsdaten und die in D1 gespeicherten Daten als Hosting-Anbieter. Details zu
          den vertraglichen Datenschutzbedingungen und möglichen Drittlandübermittlungen
          müssen vom Betreiber vor Produktivbetrieb anhand des Cloudflare-Kontos bestätigt
          werden. Eine Weitergabe zu Werbezwecken findet nicht statt.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">5. Speicherdauer</h2>
        <p>
          Account- und Planungsdaten bleiben bis zur Kontolöschung oder einer berechtigten
          manuellen Löschanfrage gespeichert. Eigene Bewertungen werden bei Kontolöschung
          entfernt; gemeldete Inhalte können vorher manuell ausgeblendet oder gelöscht
          werden. Diagnosedaten werden ungefähr 14 Tage und Feedback ungefähr sechs Monate
          aufbewahrt; alte Einträge werden bei normalen Anfragen bereinigt. Abgelaufene
          Rate-Limit-Einträge werden ebenfalls laufend entfernt. Gelöschte Daten können noch
          für die von Cloudflare vorgesehene begrenzte Wiederherstellungsdauer in
          Sicherungssystemen bestehen.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-fg">6. Deine Rechte</h2>
        <p>
          Du kannst Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und
          Widerspruch verlangen, soweit die jeweiligen Voraussetzungen vorliegen. Im Account
          kannst du deine Zugangsdaten ändern und dein Konto selbst löschen. Für Auskunft,
          Datenschutzfragen oder die Meldung einer problematischen Bewertung nutze bis zur
          Eintragung der Kontakt-E-Mail den Feedback-Button und beginne die Nachricht mit
          „Datenschutz“ oder „Bewertung melden“. Außerdem besteht ein Beschwerderecht bei
          einer Datenschutzaufsichtsbehörde.
        </p>
      </section>
    </PageShell>
  )
}
