# Proportionate privacy baseline for StudyPlanner

Reviewed: 8 September 2026. Repository baseline: `8da76f3` on
`feature/dsgvo-minimum-compliance`.

Follow-up, 10 September 2026: the user supplied Yonatan Dankner as responsible
operator, with postal address and email. The shared privacy/imprint contact now
uses those details with a plain-text `(at)` email at the user's request.
Placeholder findings below describe the
8 September baseline; see [current privacy notes](privacy-notes.md) for the update.
Outstanding notice assessments, operational checks and any joint-controller
responsibilities remain open.

The subsequent browser-storage cleanup removes disk persistence for API caches,
local diagnostics and the semester badge, and saves display preferences only on
user changes. Storage findings below describe the audit baseline. The current
inventory and outstanding deployed checks are in the linked privacy notes.

## Conclusion and scope

Keep the simplified implementation. Most remaining work is completing truthful
public information, restricting operator access, and establishing a few manual
procedures. A large compliance dashboard is unnecessary for this project.

The operator confirmed that the student group runs the service independently of
the university and anyone with the link can use it. The existing project record
describes four people and no commercial activity. Treat this as a public service,
not a household activity: an unlisted URL does not restrict the audience. Student
status and absence of revenue do not remove GDPR obligations. See the
[GDPR, Articles 2 and 4](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).

This is a source-code and documentation assessment with official legal/provider
sources, not a certification of legal compliance. Production deployments, D1
contents, account permissions, provider contracts and actual browser network
traffic were not inspected. “Implemented” below means present in this branch.
No application behavior or production settings were changed during this review.

## What is required, and the smallest reasonable solution

| Area | Assessment | Smallest useful action |
| --- | --- | --- |
| Actual operator | Missing. The university is not automatically responsible. | Identify the person(s) or organisation actually deciding purposes and means. If several people jointly do this, document responsibilities under Article 26 and publish the arrangement's essence; naming one contact does not transfer everyone else's responsibility. |
| Privacy information | Pages exist, but contain placeholders and unresolved hosting statements. | Complete a concise German notice covering actual purposes, lawful bases, recipients/transfers, retention and rights. Make it available before collection and without login. |
| Provider identification | Impressum has placeholders. | Supply real operator name, serviceable postal address and monitored email. Do not invent company registration, VAT or university details. |
| Hosting agreement and transfers | Cloudflare is identified; acceptance/account details are unverified. | Record the applicable DPA, contracting customer/entity, date, services, subprocessors and transfer safeguards. |
| Data-subject requests | Account deletion exists; other requests have no demonstrated operational process. | Monitored mailbox, named handler and backup, short private request log, manual scoped export/correction/deletion procedure. |
| Data security | Several good controls exist; shared privileged access remains. | Keep existing controls; replace shared privileged access with individual operator accounts and secure hosting access. |
| Retention | App cleanup exists but depends on traffic. | Specify achievable retention and run a periodic cleanup even during inactivity. Include old data, backups and project shutdown. |
| Accountability | Short privacy notes exist. | Expand them into a compact processing record with owner, purposes, people/data, recipients, transfers, retention and safeguards. |
| Reviews and lecturer data | Public reviews, named lecturers and catalog republication need separate consideration. | Record lawful basis/balancing, transparency and a working reporting/correction process. Clarify DSA scope before dismissing notice-handling duties. |

Controller identification and processing records can stay lightweight. Recurring
accounts and grade storage are not occasional processing, so the under-250-person
exception is not a blanket exemption from a processing record. See
[EDPB accountability guidance](https://www.edpb.europa.eu/sme/be-compliant/be-compliant_en)
and [EDPB controller FAQ](https://www.edpb.europa.eu/sme/find-practical-info/faq_en?page=1).

For a public non-family website, retain an Impressum under
[section 18(1) MStV](https://www.die-medienanstalten.de/fileadmin/user_upload/Rechtsgrundlagen/Gesetze_Staatsvertraege/Medienstaatsvertrag_MStV.pdf).
[Section 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html) has additional
scope conditions; do not claim every hobby project is a commercial business.
An authorised university address is an option only if the team can genuinely be
reached there and has permission to use it.

## What already exists

| Data/function | Evidence | Assessment |
| --- | --- | --- |
| Accounts and authentication | `backend/src/services/authentication.py`, `docs/authentication.md` | Salted PBKDF2 passwords; HttpOnly session cookie, production Secure flag, CSRF proofs, credential-change session invalidation. Keep. Password acceptance currently only rejects empty strings; a reasonable server-side minimum is a security follow-up, not a GDPR-specific mandated length. |
| Private study data | `backend/migrations/0018_user_auth_state_progress.sql`, transcript API | User state/progress includes planning and academic data. It is personal data even without a real-name requirement. |
| Transcript parsing | `frontend/src/features/transcript/utils/parseTranscriptPdf.ts`, `frontend/src/features/transcript/api.ts` | PDF parsing occurs in the browser. Extracted academic records and saved issue payloads can be sent to the API. Do not advertise that all transcript data stays on the device. |
| Account deletion | `backend/src/services/user_privacy.py`, migration 0018 and migration 0034 | Password and explicit confirmation; batched account deletion, cascade-owned records/reviews, diagnostic username detachment and linked legacy snapshot scrubbing. Keep; verify actual migrated database behavior with synthetic data. |
| Local private state | `frontend/src/shared/utils/privateBrowserData.ts`, `sessionCache.ts` | User-scoped session caches/import state and logout cleanup. Keep. Session storage is not guaranteed to mean immediate removal when a browser restores a tab. |
| Public reviews | `backend/src/services/course_reviews.py` | Public response omits author username; records remain internally account-linked. This is not full anonymisation. Moderator hide/restore exists; author deletion exists. Do not confuse these with a complete administrator erasure workflow. |
| Feedback | `backend/src/services/user_feedback.py` | No account field; manual form, six-month cleanup on submission. Free text can still identify someone; it is not guaranteed anonymous. |
| App diagnostics | `backend/src/services/client_error_log.py`, frontend diagnostic utilities | Route/query handling, heuristic redaction, 14-day cleanup on report/list, 500-row cap. Logged username remains personal data. Regex redaction is useful but cannot guarantee removal of all personal information. |
| Abuse prevention | `backend/src/services/request_rate_limit.py` | Hashed IP/account keys; cleanup on subsequent writes within the same scope, retaining stale windows for roughly another day. Unsalted SHA-256 of an IP or known account is pseudonymisation, not reliable anonymisation. |
| Public information and fonts | Legal pages, `LegalLinks.tsx`, bundled fonts, `_headers` | Privacy/imprint links and local fonts exist. No advertising/analytics integration identified in the reviewed application paths; verify provider-injected features separately. |

## Gaps to address first

### 1. Complete real contacts and correct public claims

`PrivacyPage.tsx` and `ImprintPage.tsx` still display development placeholders.
An accessible beta using real people's data already needs meaningful information;
calling it development does not defer these responsibilities.

Use one working mailbox for privacy and review reports. The feedback widget
requires a star rating, has no dedicated reply address, and sends records to D1;
the reviewed code does not demonstrate mailbox delivery or a monitored inbox.
It is a poor sole channel for legal requests. Keep it for product feedback.

Replace the generic “Article 6(1)(b) or (f)” statement with purpose-specific bases.
Proposed starting points: necessary account/planning service under (b), where an
actual service relationship supports it; proportionate security and optional
product feedback under (f), with a short necessity/balancing assessment. Lecturer
data and reviews need their own assessment; users cannot consent on lecturers'
behalf. Explain legitimate interests and objections. Do not add a blanket
“consent to the privacy policy” checkbox. Check Article 13 particulars such as
required fields/consequences and safeguards access rather than copying unrelated
boilerplate. See [EDPB rights and information guidance](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en).

Correct “non-reversible” rate-limit claims and distinguish anonymous display
from internally identifiable records. Say that no account is attached to
feedback, while submitted text and hosting metadata may contain personal data.

### 2. Resolve shared privileged access

`backend/wrangler.toml` sets `DIAGNOSTICS_ADMIN_USERNAMES = "test"`.
`course_reviews.require_review_moderator()` uses that same allow-list, so the
account can also moderate reviews. Existing notes explicitly defer this issue.
This is a genuine access-control concern, not excessive compliance work.

Assign named operators, remove shared/demo administrative rights, and review who
can access Cloudflare, D1 and repository secrets. Enable strong authentication
for hosting administrators. Confirm actual ownership and credentials privately;
do not put credentials in this report. The actual `test` account accessibility
was not tested. See [EDPB security guidance](https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en).

### 3. Cover Cloudflare processing, logs and backups accurately

The merge from `main` enabled `[observability]` with `head_sampling_rate = 1`.
The router also calls `traceback.print_exc()`. Application redaction and D1
cleanup do not control provider invocation logs or exception output. Inspect
these using synthetic requests, avoid request bodies/credentials, and document
the actual fields, access and retention. There is no automatic requirement to
disable useful operational logs.

Cloudflare documents Workers Logs retention of 3 days on Free and 7 on Paid;
D1 Time Travel is 7 days on Free and 30 on Paid. Confirm the account plan and any
exports or additional log destinations before publishing those durations.
See [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
and [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

Cloudflare's published [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)
anticipates processing outside the EEA and describes transfer safeguards. The
team must establish what applies to its account and services. Do not claim
EU-only hosting from an EU database location or assume US hosting is automatically
prohibited. Where relying on adequacy, verify current coverage; where relying on
SCCs, assess the transfer and any necessary supplementary measures. See
[EDPB transfer guidance](https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_en).

### 4. Finish the browser-storage assessment without defaulting to a banner

[Section 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html) applies to
local/session storage as well as cookies, including non-personal information.
The exception concerns storage/access strictly necessary for a service expressly
requested by the user; absence of analytics alone does not establish it.

Authentication is a strong exemption case. Review API caches, import recovery,
theme/layout settings, collapsed sections, semester badges and local diagnostics
individually. `ThemeProvider.tsx` and `usePersistedToggle.ts` write default choices
on mount, before an explicit preference change. That weakens an argument based
on remembering a requested choice. For doubtful items, use memory or persist
only a deliberately requested preference with justified duration. Keep a short
key/purpose/trigger/duration/exemption table. Add consent only if a retained
non-essential feature requires it; a large consent platform is unnecessary.

### 5. Make manual rights and retention handling real

Respond to rights requests without undue delay, normally within one month.
An eligible complex request can be extended by two months with notice/reasons
within the first month. Verify identity proportionately; do not require password
disclosure or routine ID scans. Supply a scoped copy and, when Article 20 applies,
machine-readable data. A manual export is acceptable; sending the whole database
or password hashes is not. See [EDPB rights guidance](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en).

Recommended procedure: record receipt/deadline privately, confirm scope/identity,
retrieve only the relevant account data, review third-party information, deliver
securely, and record completion. Include plans, grades, review content and any
identifiable diagnostic/support data. Provide a route for people unable to log in.

Traffic-triggered cleanup can leave old rows indefinitely on a quiet project.
A small scheduled cleanup or reliably assigned periodic manual run is enough.
Define what happens to abandoned accounts and data when the group graduates or
shuts down. The 14-day/six-month values are project choices, not statutory periods.

Check whether legacy `review_notices` contains reporter emails, allegations or
snapshots: removing its UI did not erase those records. Also check previous D1,
legacy user tables, local database exports and test datasets for real data.
Do not delete anything merely on this audit's assumption. Document backup expiry
and reapply relevant deletions before reopening a restored database. See
[EDPB retention FAQ](https://www.edpb.europa.eu/sme/find-practical-info/faq_en?page=1).

### 6. Include lecturers, public reviews and the AI catalog endpoint

Migration 0001 stores lecturer names/contact fields; the AI catalog serialises
lecturer data. Public source data remains personal data. Document ALMA as the
source, what is republished, why, recipients/public access, correction handling
and Article 14 information delivery or a specifically justified exception.
“It was already public” is not a blanket exception. See
[EDPB transparency guidance](https://www.edpb.europa.eu/system/files/2023-09/wp260rev01_en.pdf).

Keep review rules and a usable report process. A small private record of a report,
decision and response is sufficient operationally. The DSA is separate from
GDPR: assess whether this non-commercial service falls within its economic-service
scope and, if so, its hosting/platform category. Small size does not remove all
hosting obligations under Articles 16–18. A report process then needs the required
details, acknowledgement/decision communication and reasons for restrictions;
a generic rating-required feedback form is not demonstrated to satisfy them.
Do not rebuild an enterprise moderation system before resolving scope. See
[Bundesnetzagentur service duties](https://www.bundesnetzagentur.de/DE/Fachthemen/DSC/1_Themen/PflichtenVermittlunggsdienste/start.html)
and [its scope FAQ](https://www.bundesnetzagentur.de/DE/Fachthemen/DSC/1_Themen/PflichtenVermittlunggsdienste/_faq/faqTable.html).

`integrations/studyplanner-mcp/src/index.ts` separately claims “no personal data”
and no logging while acknowledging Cloudflare metadata. Its read-only catalog
purpose is good, but that absolute wording is inaccurate, including because
lecturer names and user-entered searches can identify people. If deployed, align
its notice/contact with the website. `frontend/functions/privacy.ts` proxies to
that service; keep the main German notice and integration notice consistent.

### 7. Write a short incident procedure

Assign an incident lead and backup. Record and contain a suspected breach,
identify affected people/data, restrict access, and assess notification. Notify
the competent authority without undue delay and, where feasible, within 72 hours
of awareness unless risk to individuals is unlikely. Inform affected people
without undue delay when high risk requires it. Record the reasoning even when
notification is unnecessary. Select the competent state authority from the
operator's actual establishment, not merely the university's location. A page
and a private incident log suffice. See [EDPB breach guidance](https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en).

## What would be excessive, optional, or unsafe to remove

| Item | Recommendation |
| --- | --- |
| Dedicated data protection officer | No obvious trigger for the described four-person planner. Check GDPR Article 37 and section 38 BDSG exceptions, including processing requiring a DPIA or certain data-transfer/research businesses. A team privacy contact is useful and is not a formal DPO. |
| Full DPIA by default | No high-risk processing established by this review. Record a short screening, particularly for public lecturer reviews; reconsider with scale, monitoring, special-category data or significant automated decisions. Ordinary grades are confidential but not automatically Article 9 special-category data. |
| Consent for ordinary account operation | Avoid blanket consent where a valid service/legitimate-interest basis applies. A privacy notice informs; it is not itself a consent contract. |
| Automated export portal and request ticket system | Optional. A tested manual process can meet obligations at this scale. Keep existing self-service deletion. |
| Complex retention holds and moderation state machines | No need to restore abandoned workflows by default. Keep applied migrations intact and handle any residual data. |
| Consent banner for every visitor | Not automatically required. Resolve questionable storage first; only retained non-essential storage/access needs a suitable consent mechanism. |
| Paid compliance suite, certification, mandatory German-only hosting | No general requirement identified for this project. Existing hosting can be assessed before considering a move. |
| Removal of CSRF, cookie security, password hashing or access checks | Do not simplify these away. They protect the grade/account data the service actually holds. |
| Mandatory identity verification for every user | No general need shown. Collecting IDs or requiring university affiliation would add data and complexity. |
| Full deletion of review reporting safeguards | Too far. A practical way to report and resolve harmful content remains necessary; additional DSA duties depend on scope. |

The DPO size threshold concerns people regularly processing personal data, not
registered website users. See [section 38 BDSG](https://www.gesetze-im-internet.de/bdsg_2018/__38.html).
DPIA/security measures depend on actual risk; see
[EDPB security and risk guidance](https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en).

## Proposed implementation order

1. **Operator facts and access:** agree who operates the service, provide address
   and mailbox, establish named administrators, and confirm hosting contracts.
2. **Truthful public pages:** complete German notice/imprint, correct anonymity
   claims, add lecturer/source information, and align the integration notice.
3. **Small technical fixes:** justify or remove unnecessary storage, secure the
   actual operator accounts, ensure retention during inactivity, and make contact
   and review reporting usable without a star rating or login.
4. **One internal record:** finish the processing inventory, request/export steps,
   incident steps, review handling, backup/restore and shutdown responsibilities.
5. **Release verification with synthetic accounts:** test privacy links before
   registration, storage/network behavior before interaction and after logout,
   cross-account isolation, deletion/export coverage, admin boundaries, and log
   contents/cleanup. Verify deployed configuration and migrations separately.

Open operator facts: actual legal identity/address and federal state; who makes
joint decisions; real user count and whether minors are expected; Cloudflare
customer/plan/DPA and dashboard features; existing real data in previous systems;
who monitors requests while the team is unavailable. None should be invented.

The preceding merge checks passed (347 frontend tests, 5 skipped; 206 backend
tests; lint/build/config verification). Those checks support implementation
stability, not legal compliance or production verification. This audit changes
documentation only and does not require application deployment.
