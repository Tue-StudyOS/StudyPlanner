# Privacy implementation input

Fill in this file and tell me when it is ready. This is the single input file for
the next implementation pass. Background: [privacy audit](privacy-audit-2026-09.md).

## How to fill it in

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

## Already confirmed

- The student group operates the website independently of the university.
- Anyone with the link can use it; it is not restricted to the group.
- The goal is a simple, proportionate implementation.
- Existing account security and self-service deletion should remain intact.

Corrections to the above, if any: TODO (or `NONE`)

## 1. Operator and public contact details

These answers supply the Impressum and privacy notice. A contact person and the
actual operator can be different; describe the situation rather than guessing a
legal company type.

| Information | Your answer |
| --- | --- |
| Who actually runs the service and decides how user data is used? List the people or existing organisation involved. | TODO |
| Is there one decision-maker or do several members decide together? | TODO |
| Exact full operator name(s) intended for the public pages | TODO |
| Public postal address: street, number, postcode, city, country | TODO |
| German federal state where the operator is based | TODO |
| If using a university/other organisation's address: permission and ability to receive mail there confirmed? | TODO |
| Public email for privacy requests and review reports | TODO |
| Is this mailbox working, and who checks it? A first name/team role is enough internally. | TODO |
| Backup person during holidays/exams | TODO |

Which of the above details are ready to appear on the website, and which are
still drafts? TODO

If several people jointly operate the service, describe the division of work
(hosting, development, user requests, moderation): TODO

## 2. Actual use and release status

| Information | Your answer |
| --- | --- |
| Current public website URL(s) | TODO |
| Is the site already used with real accounts/grades? Approximate user count? | TODO |
| Team size: the existing notes say four people; is that correct? | TODO |
| Any fees, advertising, affiliate links, donations, sponsorship or planned monetisation? | TODO (or `NONE`) |
| Intended audience; are users under 18 expected? | TODO |
| Is the ChatGPT/Claude/MCP catalog integration publicly available and still wanted? | TODO |
| Target date or event for the next release, if any | TODO |

## 3. Small implementation choices

Write `ACCEPT` in each row you agree with. You can accept most rows and change
only the ones that matter to you. Legal applicability will still be checked
against the facts; these are product choices, not declarations of compliance.

| ID | Recommendation | Your decision |
| --- | --- | --- |
| D1 | Keep the existing planner, accounts, browser PDF parsing and account deletion. | TODO |
| D2 | Publish concise German privacy/imprint pages; avoid blanket privacy-consent checkboxes. Say if English is also wanted. | TODO |
| D3 | Use a clearly visible email link for privacy requests and review reports, accessible without login or a star rating. Keep product feedback separate. | TODO |
| D4 | Handle access/export/correction requests manually with a small operator procedure and a scoped export helper if needed; no user-facing privacy dashboard. | TODO |
| D5 | Keep public course reviews and existing moderation. Provide a report link including the course/review reference and a simple manual response procedure. | TODO |
| D6 | Keep existing custom lecturer-name input for now; document its purpose and safeguards before deciding whether to restrict it. | TODO |
| D7 | Keep the site free of analytics/advertising. Review storage individually; remove unjustified persistence or use memory instead of adding a consent platform. Persist requested UI choices only where justified. | TODO |
| D8 | Replace shared/demo administrator privileges with named operators. Keep the existing security protections. | TODO |
| D9 | Retain minimal diagnostics for troubleshooting; remove usernames from new app error records unless a specific support need is identified. Verify provider logs separately. | TODO |
| D10 | Keep the currently configured Cloudflare services and active database. Verify processing arrangements; no hosting/database migration in this change. | TODO |
| D11 | Keep internal documentation small: processing record plus practical request, moderation, incident and cleanup instructions. | TODO |

Features or behavior that must not change: TODO (or `NONE`)

Other priorities or decisions: TODO (or `NONE`)

## 4. Administrator access

Use existing application usernames only, never passwords. Listing an operator
does not verify that the account is controlled by that person.

| Information | Your answer |
| --- | --- |
| App usernames allowed to inspect diagnostics | TODO |
| App usernames allowed to moderate reviews | TODO |
| Are these individual accounts already created and controlled by the intended operators? | TODO |
| Who currently uses the shared `test` account? Is it a public demo account? | TODO |
| What should happen to `test`? Suggested: remove privileges and keep ordinary/demo data unchanged pending review. | TODO |
| Who manages Cloudflare and production deployments? Team role/name only. | TODO |
| Is two-factor authentication enabled for hosting administrators? | TODO |

## 5. Hosting facts

`UNKNOWN` is a useful answer here. Do not accept contractual terms just to fill
in this form. The implementer must distinguish repository config from confirmed
account settings and can provide verification steps for anything missing.

| Information | Your answer |
| --- | --- |
| Cloudflare contracting customer: person or organisation (no account ID needed) | TODO |
| Cloudflare plan: Free / Paid / UNKNOWN | TODO |
| Has the applicable data-processing agreement been confirmed? By whom and when? Public terms link or private evidence reference only. | TODO |
| Any known region settings, transfer safeguards or related contract evidence? | TODO |
| Cloudflare Analytics, Web Analytics, Zaraz, Turnstile or other dashboard features enabled? | TODO |
| Other providers: domain registrar, contact mailbox, monitoring, external backups, etc. | TODO |
| Logs exported elsewhere or database backups downloaded? Where, who has access, and for how long? Do not include contents. | TODO |
| Known provider log/backup retention, if checked | TODO |

## 6. Retention and old data

The durations below are implementation proposals based on the current app, not
legal deadlines. An accepted schedule must also work when nobody visits the site.

| ID | Recommendation / question | Your decision |
| --- | --- | --- |
| R1 | App diagnostics: 14 days, maximum 500 entries, cleanup daily. | TODO |
| R2 | Product feedback: six calendar months, cleanup daily. | TODO |
| R3 | Rate-limit records: remove expired windows after roughly one additional day, cleanup daily. | TODO |
| R4 | Cleanup mechanism: small automated daily job. If preferring manual cleanup, specify responsible person and frequency. | TODO |
| R5 | Keep account/planning data while the account is in use and remove it on deletion. For inactive accounts, what period and warning process would you support? Leave UNKNOWN for a proposal; no automatic account deletion without an agreed rule. | TODO |
| R6 | Project shutdown: who decides and communicates closure, and how much time should users have to retrieve their data? | TODO |

Do any of these contain real user data: previous test database, legacy
`review_notices`, old user tables, local exports, test fixtures? List known
locations and who can verify them; do not include records: TODO

Any data that must be retained for an existing unresolved request/dispute?
State only that a restriction exists and who to contact privately: TODO (or `NONE`)

Legacy-data handling recommendation: inventory first and propose precisely scoped
cleanup before deleting existing records. Your decision: TODO

## 7. Lecturer data and reports

| Information | Your answer |
| --- | --- |
| Why are lecturer names/custom lecturer names useful to users? | TODO |
| Do you need lecturer emails/contact details, or would names and course associations be enough? | TODO |
| Known ALMA reuse permission, agreement or correspondence? Public link/private reference only; UNKNOWN is fine. | TODO |
| Have lecturers already been informed about this service, or is there an existing public notice? | TODO |
| Who handles review reports and lecturer correction/removal requests? | TODO |
| Where can the team keep a small private request/incident record with restricted access? | TODO |

## 8. Handoff

Filled in by / date: TODO

Answers still awaiting another team member or account check: TODO (or `NONE`)

Anything else the implementer should know: TODO (or `NONE`)

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
