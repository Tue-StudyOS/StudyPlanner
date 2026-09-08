# Privacy implementation input

Fill in this file and tell me when it is ready. This is the single input file for
the next implementation pass. Background: [privacy audit](privacy-audit-2026-09.md).

## Local implementation update — 8 September 2026

The user authorised implementation and explicitly requested sample operator
details for local review. The legal pages now use Max Mustermann, Musterstraße 1,
12345 Musterstadt, Deutschland, and datenschutz@example.invalid from one shared
`frontend/src/features/legal/legalOperator.ts` configuration. These are preview
values only; the real operator facts below remain UNKNOWN.

Implemented: D1/D2 preservation and legal-page improvements; D3 contact display
with an inert sample mailbox; a small manual D4/D11 procedure in privacy-notes.md;
accurate descriptions of the existing storage, diagnostics and retention behavior.
The broad implementation request does not reverse the explicit database or
administrator restrictions. D5/D6 behavior, D8 access, D9 logged fields and
retention/database operations remain unchanged. Storage behavior and the separate
AI integration remain pending concrete decisions/verification.

## How to fill it in

Latest follow-up: the user approved the deleted-account session fix, anonymous
feedback, and minor dead-code cleanup. Registration now randomises the existing
session-version field for each new account; no schema migration or existing-row
rewrite was added. Feedback now omits account cookies, referrer, page context and
automatic authenticated diagnostics. Server-side metadata is normalised without
changing the feedback schema. Existing catalog headers were explicitly left alone.
Shared administrator access and applied migration history remain unchanged.

- Replace `TODO` with your answer. Short answers in English or German are fine.
- Write `UNKNOWN` when you do not know; I will identify how to verify it.
- For a recommendation, write `ACCEPT` or describe your alternative.
- Recommendations are proposals, not already accepted decisions. Blank answers
  do not authorise feature removal, data deletion or publication of personal details.
- Fill sections 1–3 first. You do not need to research legal articles or Cloudflare
  internals yourself; factual answers and preferences are enough.
- This file is tracked by Git. Only put intended public contact details here.
  Use a local file reference for private evidence; do not paste passwords, tokens,
  customer records, reports from users or private contracts into this file.

## Review of your answers — 8 September 2026

Your small-project approach is reasonable. Keep the existing protections, use
manual request handling, and avoid a new privacy dashboard, ticket system or
complex moderation workflow. A separate company, office, paid compliance suite
or automated daily cleanup is not a prerequisite just to complete this brief.

`UNKNOWN` is appropriate for facts you have not verified. It is an internal
placeholder, not text for the public notice and not an exemption from resolving
required information. No rejected decision below has been changed to `ACCEPT`.

### Resolve these before calling the public legal pages complete

| Item | What needs to happen |
| --- | --- |
| Full operator identity | First names and “we are students” are insufficient for the final operator identification. Agree which real people/entity operate the service and the full public identification. You need not form a company. |
| Postal address | No separate office is needed, but the applicable public provider identification needs an address at which the operator can actually be reached. An authorised university or other serviceable address may be an option; do not invent one or publish an address without authority. |
| Working contact | Choose one monitored email address and a handler. A separate backup person is optional if the group can reliably provide cover. |
| Hosting facts | Keep the confirmed Free plan. Verify the actual account customer, processing terms and enabled services before publishing claims about them. |
| Shared privileged access | You rejected changing it. Preserve that instruction, but do not describe access as individually restricted or verified safe until ownership/access has been checked. |
| Review decision | Your “No” rejects the combined D5 proposal; it does not tell us whether you want reviews removed, unchanged, or only a simpler reporting process. Preserve behavior until clarified. |

The identification point follows [section 18(1) MStV](https://www.die-medienanstalten.de/fileadmin/user_upload/Rechtsgrundlagen/Gesetze_Staatsvertraege/Medienstaatsvertrag_MStV.pdf).
Clear information and a usable rights channel are covered by
[EDPB rights guidance](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en).
The shared-access concern follows [EDPB security guidance](https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en).

### Simplifications recommended for this project

- One contact mailbox and a short private record; no dedicated request portal.
- One short internal operating note; no separate policy for every feature.
- Manual export first; build an export helper only if an actual request makes it
  useful. The team still needs to be able to retrieve the relevant data.
- Agree a realistic cleanup method later. Do not promise daily deletion merely
  because the original questionnaire suggested it.
- Defer a new inactivity-deletion feature, custom moderation state machine and
  blanket age-verification system. Do not remove existing protections.
- Keep technical/provider uncertainties for implementation verification instead
  of asking the student group to guess legal conclusions.

This review edits the brief only. It does not make the deployed legal pages
complete, change access rights, or alter the database.

## Already confirmed

- The student group operates the website independently of the university.
- Anyone with the link can use it; it is not restricted to the group.
- The goal is a simple, proportionate implementation.
- Existing account security and self-service deletion should remain intact.

Corrections to the above, if any:  `NONE`

## 1. Operator and public contact details

These answers supply the Impressum and privacy notice. A contact person and the
actual operator can be different; describe the situation rather than guessing a
legal company type.

| Information | Your answer |
| --- | --- |
| Who actually runs the service and decides how user data is used? List the people or existing organisation involved. | Lena, Emre, Ben and Yonatan; full public identification is unresolved. |
| Is there one decision-maker or do several members decide together? | All four decide together. Assess the appropriate joint-operator arrangement from these facts. |
| Exact full operator name(s) intended for the public pages | UNKNOWN — no full names approved for publication yet; required information to resolve, not “no operator”. |
| Public postal address: street, number, postcode, city, country | UNKNOWN — the group reports no project address; choose an authorised serviceable address before completing the Impressum. |
| German federal state where the operator is based | Baden-Württemberg |
| If using a university/other organisation's address: permission and ability to receive mail there confirmed? | UNKNOWN |
| Public email for privacy requests and review reports | UNKNOWN |
| Is this mailbox working, and who checks it? A first name/team role is enough internally. | UNKNOWN |
| Backup person during holidays/exams | UNKNOWN |

Which of the above details are ready to appear on the website, and which are
still drafts? UNKNOWN — no complete operator/contact block is ready for publication.

If several people jointly operate the service, describe the division of work
(hosting, development, user requests, moderation): We are just one group of students, we all do everything together. We are not a company or an organisation.

## 2. Actual use and release status

| Information | Your answer |
| --- | --- |
| Current public website URL(s) | One service confirmed. Exact current URL: UNKNOWN; verify deployment rather than guessing from repository configuration. |
| Is the site already used with real accounts/grades? Approximate user count? | UNKNOWN — operator says “not really”; this is not confirmation of zero real accounts or grades. Verify with the team without copying user data here. |
| Team size: the existing notes say four people; is that correct? | Yes |
| Any fees, advertising, affiliate links, donations, sponsorship or planned monetisation? | NO |
| Intended audience; are users under 18 expected? | University students; under-18 users are not specifically targeted but can use the site. Actual ages: UNKNOWN. No adult-content offering reported. Do not infer a need for identity checks or that age-related privacy questions are settled. |
| Is the ChatGPT/Claude/MCP catalog integration publicly available and still wanted? | UNKNOWN |
| Target date or event for the next release, if any | UNKNOWN |

## 3. Small implementation choices

Write `ACCEPT` in each row you agree with. You can accept most rows and change
only the ones that matter to you. Legal applicability will still be checked
against the facts; these are product choices, not declarations of compliance.

| ID | Recommendation | Your decision |
| --- | --- | --- |
| D1 | Keep the existing planner, accounts, browser PDF parsing and account deletion. | ACCEPT |
| D2 | Publish concise German privacy/imprint pages; avoid blanket privacy-consent checkboxes. Say if English is also wanted. | ACCEPT |
| D3 | Use one visible email link for requests/reports without login or a star rating. No new contact backend needed for this option. | UNKNOWN — recommended simplest option; mailbox not selected. |
| D4 | Manual handling with a short procedure; export helper only if needed. No user-facing privacy dashboard. | UNKNOWN — recommended; a working manual process still needs a handler. |
| D5 | Decide whether reviews remain and how reports are handled; avoid a new moderation platform. | REJECTED as originally proposed (“No”). Desired alternative: UNKNOWN. Do not remove reviews, reports or moderation based on this answer. |
| D6 | Decide whether custom lecturer-name input should remain; this is separate from database changes. | Database changes rejected. Feature decision: UNKNOWN. Preserve existing input and records pending clarification. |
| D7 | Keep analytics/advertising absent; assess storage individually before changing persistence. | No analytics or advertising confirmed. Storage changes: UNKNOWN; do not treat this answer as blanket approval. |
| D8 | Replace shared/demo administrator privileges with named operators. Keep the existing security protections. | REJECTED (“no”). Do not change privileges under this brief; actual access remains unverified and a security concern to resolve. |
| D9 | Retain minimal diagnostics for troubleshooting; remove usernames from new app error records unless a specific support need is identified. Verify provider logs separately. | UNKNOWN |
| D10 | Keep the current database; verify hosting arrangements without changing them. | Do not change the database. No schema/data changes, new database, swap or migration authorised by this brief. Hosting changes also require a concrete decision. |
| D11 | Keep internal documentation small: processing record plus practical request, moderation, incident and cleanup instructions. | ACCEPT |

Features or behavior that must not change: Preserve the database and existing
security controls. Do not infer review removal or administrator changes from
ambiguous/rejected answers. Other constraints: UNKNOWN.

Other priorities or decisions: Keep the project simple and make public legal
information accurate. Other priorities: UNKNOWN.

## 4. Administrator access

Use existing application usernames only, never passwords. Listing an operator
does not verify that the account is controlled by that person.

| Information | Your answer |
| --- | --- |
| App usernames allowed to inspect diagnostics | UNKNOWN — repository currently lists `test`; this is not verification of intended access. |
| App usernames allowed to moderate reviews | UNKNOWN — current code uses the diagnostics allow-list. |
| Are these individual accounts already created and controlled by the intended operators? | UNKNOWN |
| Who currently uses the shared `test` account? Is it a public demo account? | UNKNOWN |
| What should happen to `test`? | No privilege change authorised (D8). Account ownership and safe intended use: UNKNOWN. |
| Who manages Cloudflare and production deployments? Team role/name only. | Group works together; actual account/deployment owner: UNKNOWN. |
| Is two-factor authentication enabled for hosting administrators? | UNKNOWN |

## 5. Hosting facts

`UNKNOWN` is a useful answer here. Do not accept contractual terms just to fill
in this form. The implementer must distinguish repository config from confirmed
account settings and can provide verification steps for anything missing.

| Information | Your answer |
| --- | --- |
| Cloudflare contracting customer: person or organisation (no account ID needed) | UNKNOWN |
| Cloudflare plan: Free / Paid / UNKNOWN | Free |
| Has the applicable data-processing agreement been confirmed? By whom and when? Public terms link or private evidence reference only. | UNKNOWN |
| Any known region settings, transfer safeguards or related contract evidence? | UNKNOWN |
| Cloudflare Analytics, Web Analytics, Zaraz, Turnstile or other dashboard features enabled? | UNKNOWN |
| Other providers: domain registrar, contact mailbox, monitoring, external backups, etc. | UNKNOWN |
| Logs exported elsewhere or database backups downloaded? Where, who has access, and for how long? Do not include contents. | UNKNOWN |
| Known provider log/backup retention, if checked | UNKNOWN |

## 6. Retention and old data

The durations below are implementation proposals based on the current app, not
legal deadlines. An accepted schedule must also work when nobody visits the site.

| ID | Recommendation / question | Your decision |
| --- | --- | --- |
| R1 | Current app policy: 14 days, maximum 500 diagnostic entries; cleanup depends on requests. Verify effectiveness before promising a maximum duration. | UNKNOWN — proposed policy not accepted; no new deletion authorised. |
| R2 | Current app policy: six calendar months for feedback; cleanup on submission. | UNKNOWN — proposed policy not accepted; no new deletion authorised. |
| R3 | Current app removes stale rate-limit windows on later writes, after roughly one additional day. | UNKNOWN — verify actual cleanup; no new deletion authorised. |
| R4 | Choose a reliable periodic cleanup method when agreeing retention. A daily scheduled job is optional, not a legal requirement. | UNKNOWN — defer implementation; respect the no-database-change instruction. |
| R5 | Keep account/planning data while the account is in use and remove it on deletion. For inactive accounts, what period and warning process would you support? Leave UNKNOWN for a proposal; no automatic account deletion without an agreed rule. | UNKNOWN |
| R6 | Project shutdown: who decides and communicates closure, and how much time should users have to retrieve their data? | UNKNOWN |

Do any of these contain real user data: previous test database, legacy
`review_notices`, old user tables, local exports, test fixtures? List known
locations and who can verify them; do not include records: UNKNOWN

Any data that must be retained for an existing unresolved request/dispute?
State only that a restriction exists and who to contact privately: UNKNOWN

Legacy-data handling recommendation: inventory first and propose precisely scoped
cleanup before deleting existing records. Your decision: Do not change/delete
database records. Inventory contents and any later cleanup decision remain UNKNOWN.

## 7. Lecturer data and reports

| Information | Your answer |
| --- | --- |
| Why are lecturer names/custom lecturer names useful to users? | To plan the semester and know who is teaching which courses. |
| Do you need lecturer emails/contact details, or would names and course associations be enough? | Names and course associations are enough. Operator believes no lecturer emails are held; actual stored/exposed fields: UNKNOWN (schema has an email column). Do not claim absence or delete data without verification. |
| Known ALMA reuse permission, agreement or correspondence? Public link/private reference only; UNKNOWN is fine. | UNKNOWN |
| Have lecturers already been informed about this service, or is there an existing public notice? | UNKNOWN |
| Who handles review reports and lecturer correction/removal requests? | UNKNOWN |
| Where can the team keep a small private request/incident record with restricted access? | UNKNOWN |

## 8. Handoff

Filled in by / date: Operator answers reviewed by the assistant on 8 September
2026. No new recommendation was accepted on the operator's behalf.

Answers still awaiting another team member or account check: Full public operator
identity, serviceable address, monitored email, exact URL and real-data usage;
Cloudflare customer/terms/features; privileged-account ownership; intended review
behavior. Other UNKNOWN items can be investigated during implementation.

Anything else the implementer should know: Keep unresolved facts in this internal
brief; never copy UNKNOWN or unsupported “we collect no personal data” claims to
the public legal pages. Documentation changes alone do not fix runtime gaps.

### Instructions for the implementation pass

Use explicit answers as the implementation brief and refer to decision IDs in
the change summary. Treat `TODO`/`UNKNOWN` as unresolved, not as consent to the
recommendation. Continue work that does not depend on missing facts. Do not
invent operator identities, contracts, retention facts or legal conclusions.
Keep private operational details out of public pages and Git. Verify legal and
provider details when implementing. Preserve the existing database and migration
history. Filling this file does not itself deploy the app, authorise bulk deletion,
send messages, or accept provider terms; follow the user's implementation request
and existing repository workflow when the work begins.
