# StudyPlanner privacy and compliance record

Status: operator template — complete and approve this record in restricted storage

Repository version: `____________________`

Record owner: `____________________`

Approved by / role: `____________________`

Approval date: `YYYY-MM-DD`

Next scheduled review: `YYYY-MM-DD`

## How to use this template

Copy this template to the operator's access-controlled compliance store. Do not
complete it in the public repository when an answer contains a private address,
signature, account identifier, request evidence, incident evidence, credentials,
or other non-public information. Record the restricted storage location here by
system/folder name only; never include a password, token, recovery code, private
URL, or encryption key.

Restricted record location: `____________________`

Evidence owner and access group: `____________________`

The operator must verify every factual statement before publishing the privacy
notice or imprint. Empty fields are open actions, not evidence of compliance.
Legal conclusions should be reviewed by qualified counsel where the operator's
facts or the service classification are uncertain.

## 1. Controller and service facts

| Field | Verified value | Evidence / review date |
| --- | --- | --- |
| Full controller name and legal form | `____________________` | `____________________` |
| Public postal address | `____________________` | `____________________` |
| Monitored privacy/contact email | `____________________` | `____________________` |
| Representative, if applicable | `Not applicable / ______` | `____________________` |
| Register and registration number, if applicable | `Not applicable / ______` | `____________________` |
| VAT/economic ID, if applicable | `Not applicable / ______` | `____________________` |
| Supervisory authority, if applicable | `Not applicable / ______` | `____________________` |
| Editorially responsible person under MStV, if applicable | `Not applicable / ______` | `____________________` |
| University mandate or affiliation | `None / verified details: ______` | `____________________` |
| Commercial, advertising, or affiliate activity | `No / verified details: ______` | `____________________` |
| People regularly handling personal data | `____________________` | `____________________` |
| Public-body status | `No / Yes: ______` | `____________________` |
| Production data stores outside D1 | `None / verified list: ______` | `____________________` |

## 2. Record of processing activities

Complete the owner and approval columns after checking that the deployed control
matches the stated retention. Where the legal basis is legitimate interests,
link the corresponding assessment in section 4.

| Activity and purpose | Data subjects and data categories | Recipients / transfers | Legal basis | Retention and implemented control | Control owner | Approved |
| --- | --- | --- | --- | --- | --- | --- |
| Account registration, authentication, and delivery | Users; username/login identifier, email, display name, password hash/salt, account timestamps, session cookie | Cloudflare Pages, Workers, and D1; transfer mechanism per section 3 | GDPR Art. 6(1)(b) | Until account deletion; session cookie expires after 30 days; self-service deletion control | `______` | `YYYY-MM-DD / ______` |
| Study profile and saved planning | Users; programme, regulation, semester, settings, favourites, plans, notes, assignments | Cloudflare Pages, Workers, and D1 | GDPR Art. 6(1)(b) | Until individual removal or account deletion | `______` | `YYYY-MM-DD / ______` |
| Academic progress and transcript review | Users; completed courses, grades, ECTS, semesters, import candidates/issues | Cloudflare Pages, Workers, and D1 | GDPR Art. 6(1)(b) | Saved D1 data until removal/account deletion; browser candidates only for current session | `______` | `YYYY-MM-DD / ______` |
| Public course reviews | Users, lecturers, and site visitors; ratings, comment, semester, selected lecturer, author account link, moderation state | Public visitors for published content; Cloudflare for delivery/storage | GDPR Art. 6(1)(b) for publication requested by author; Art. 6(1)(f) for moderation/security, subject to section 4 | Until author/account deletion or final moderation decision; hidden content deleted after 6 months unless an active dispute requires longer retention | `______` | `YYYY-MM-DD / ______` |
| Product feedback | Visitors; rating, free text, page path, source, submission time; text may identify a person | Cloudflare Workers and D1; authorised maintainers | GDPR Art. 6(1)(f), subject to section 4 | Delete after 6 months | `______` | `YYYY-MM-DD / ______` |
| Client-error diagnostics | Users/visitors; minimised method/route, status, error code, redacted message/detail, duration, page path, optional username, time | Cloudflare Workers and D1; authorised diagnostics operators | GDPR Art. 6(1)(f), subject to section 4 | Delete after 14 days and retain no more than 500 rows | `______` | `YYYY-MM-DD / ______` |
| Abuse and rate limiting | Users/visitors; SHA-256 key derived from IP address or login identifier, scope, window, count | Cloudflare Workers and D1 | GDPR Art. 6(1)(f), subject to section 4 | Delete 24 hours after the rate-limit window | `______` | `YYYY-MM-DD / ______` |
| Review notices and decisions | Notifiers, review authors; notice category/reason, review reference, receipt/status, decision and moderator record | Cloudflare Workers and D1; authorised review moderators | GDPR Art. 6(1)(c) and/or Art. 6(1)(f), subject to the DSA assessment | Delete 6 months after closure unless an active dispute or legal duty requires longer | `______` | `YYYY-MM-DD / ______` |
| Public AI/MCP course lookup | Integration users; entered search term or course identifier; request metadata processed by delivery providers | Cloudflare; AI provider selected by the user under its own terms | `Art. 6 basis: ______` | Application does not intentionally persist lookup content; verify provider/runtime logs and their retention | `______` | `YYYY-MM-DD / ______` |
| D1 recovery history | Subjects represented in the underlying D1 rows | Cloudflare D1 | Basis follows underlying data; Arts. 5 and 32 for availability/security | Cloudflare Time Travel only: verified duration `______`; no indefinite exports by default | `______` | `YYYY-MM-DD / ______` |
| Necessary browser/device storage | Users/visitors; session cookie, private session cache/API log/import candidates, explicit UI preferences | User's browser; Cloudflare receives the session cookie | Basis follows the feature; section 25 TDDDG necessity | Private entries: current session, cache TTL no more than 24 hours, clear on logout/deletion. Preferences: until changed/cleared | `______` | `YYYY-MM-DD / ______` |

### Technical and organisational measures summary

Use `docs/privacy/security-operations.md` as the implementation checklist, then
record the deployed evidence and accountable people in this restricted copy.

- Access control and role assignments: `____________________`
- Authentication, password hashing, CSRF, and session controls: `____________________`
- Encryption in transit and provider controls: `____________________`
- Data minimisation, redaction, and retention jobs: `____________________`
- Export, correction, and deletion controls: `____________________`
- Backup/recovery and post-restore erasure reconciliation: `____________________`
- Change review, tests, logging, and incident monitoring: `____________________`
- Last control verification, result, and reviewer: `____________________`

## 3. Processor and subprocessor register

### Cloudflare

| Field | Verified value / evidence |
| --- | --- |
| Legal Cloudflare customer | `____________________` |
| Services in use | `Pages / Workers / D1 / other: ______` |
| DPA version and effective date | `6.4 effective 2026-04-03 / replacement: ______` |
| Customer acceptance date and evidence location | `____________________` |
| Subprocessor list review date and material findings | `____________________` |
| International-transfer mechanism and covered entities | `____________________` |
| Active plan | `____________________` |
| D1 database | `studyplanner-db` (`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`) |
| D1 jurisdiction | `____________________` |
| D1 storage version | `____________________` |
| D1 read replication setting | `____________________` |
| D1 Time Travel duration | `____________________` |
| Fact source and check date | `Dashboard / wrangler d1 info / ______`; `YYYY-MM-DD` |

Record the actual D1 facts from the Cloudflare dashboard or from
`wrangler d1 info studyplanner-db`. This check is read-only: do not create, swap,
or migrate to another database while completing this record. Any future database
cutover requires a separate approved migration that preserves user data and keys
course-related user data by stable ALMA course number.

### Other processors or recipients

| Provider / recipient category | Purpose and data | Contract / transfer safeguard | Retention | Owner and last review |
| --- | --- | --- | --- | --- |
| `____________________` | `____________________` | `____________________` | `____________________` | `____________________` |

Enter `None identified` only after checking production integrations, exports,
support inboxes, issue trackers, monitoring, and local backups.

## 4. Legitimate-interest assessments

Complete one copy of this block for diagnostics, rate limiting, feedback, and
review moderation. A conclusion without the necessity and balancing analysis is
not an approval.

### Assessment: `diagnostics / rate limiting / feedback / review moderation`

- Decision owner and date: `____________________`
- Purpose and specific legitimate interest: `____________________`
- Why the processing is necessary for that purpose: `____________________`
- Less intrusive alternatives considered and why insufficient: `____________________`
- Data categories, affected people, and reasonable expectations: `____________________`
- Possible impact, including vulnerable users: `____________________`
- Safeguards (minimisation, access, retention, objection route): `____________________`
- Balancing conclusion: `approved / rejected / changes required`
- Reassessment trigger/date: `____________________`

Repeat this block in the restricted copy until all four activities have a signed
assessment.

## 5. DPO threshold and DPIA screening

### Data protection officer assessment

| Question | Evidence-based answer |
| --- | --- |
| Is the controller a public authority/body? | `____________________` |
| Do core activities require regular and systematic large-scale monitoring? | `____________________` |
| Do core activities involve large-scale special-category or criminal-conviction data? | `____________________` |
| How many people regularly process personal data and does section 38 BDSG apply? | `____________________` |
| Other mandatory-designation facts | `____________________` |
| Outcome, reasoning, approver, and date | `____________________` |

### DPIA screening

Record scale, sensitivity, systematic monitoring, vulnerable subjects, innovative
technology, data matching, exclusion from a service, and other high-risk factors.

- Screening facts: `____________________`
- Likelihood and severity of risks before controls: `____________________`
- Existing controls: `____________________`
- Is high residual risk likely? `Yes / No / uncertain`
- DPIA required: `Yes / No / seek advice`
- Reasoned outcome, approver, and date: `____________________`
- Change triggers: new sensitive data, large-scale monitoring, profiling,
  materially new AI processing, new data matching, or a major audience/scale change.

## 6. DSA classification for public reviews

- Service and review feature examined: `____________________`
- Hosting/intermediary/online-platform classification considered: `____________________`
- Ancillary-feature analysis and evidence: `____________________`
- Applicable exemptions and operator-size facts: `____________________`
- Notice/action duties and required contact channel: `____________________`
- Review rules and moderation decision workflow: `____________________`
- Responsible moderator coverage: `____________________`
- Outcome, legal reviewer/approver, and date: `____________________`
- Reassessment triggers: material feature change, public visibility change,
  monetisation, recommendation/ranking change, or legal guidance/case-law change.

Until the classification is approved and a notice/action process can be staffed,
record whether new/public reviews must be disabled: `____________________`.

## 7. Data-subject request procedure

1. Record the request received date, channel, scope, and deadline in the restricted
   request log. Never commit a request or identity evidence to the repository.
2. Verify identity proportionately. Request only the minimum additional evidence
   needed and delete that evidence promptly after verification.
3. Search D1 and every verified external store in section 2. Ask the requester to
   clarify only when necessary; do not use clarification to delay a clear request.
4. Apply access, correction, erasure, restriction, portability, or objection as
   applicable. Record the decision and any data that could not legally be erased.
5. Respond without undue delay and normally within one month. Record the reason
   and timely notice for any permitted extension.
6. Reconcile erasure after any later D1 recovery operation before reopening the
   service, so restored data is not silently retained.
7. Delete request identity evidence and operational copies under the approved
   request-record retention schedule.

Restricted request-log fields:

| Request ID | Received | Request type/scope | Identity check | Stores searched | Decision/action | Response due/sent | Extension | Evidence deletion date | Handler |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `______` | `______` | `______` | `______` | `______` | `______` | `______` | `______` | `______` | `______` |

Request channel tested on `YYYY-MM-DD` by `____________________`; result:
`____________________`.

## 8. Personal-data breach procedure

1. Contain the issue without destroying evidence; restrict affected access and
   preserve an incident timeline in the restricted incident store.
2. Establish what happened, which systems/data subjects/data categories are
   affected, approximate volume, likely consequences, and current safeguards.
3. Notify the controller's incident owner immediately. Record discovery time;
   the 72-hour supervisory-authority decision clock runs from awareness, not from
   completion of the investigation.
4. Assess risk to people's rights and freedoms. Document the decision whether a
   supervisory-authority notification is required and, for high risk, whether
   affected people must be informed.
5. If notification is required, submit available facts within 72 hours where
   feasible and provide missing information in phases. Record and explain delay.
6. Remediate, verify containment, evaluate processor notifications, and document
   lessons and preventive actions. Keep a breach record even when no notification
   is required.
7. If credentials or privileged sessions were exposed, follow the approved
   credential/session-revocation procedure and communicate user impact.

Incident decision fields: incident ID; discovery/awareness times; reporter;
systems; data/people/volume; containment; risk analysis; authority decision and
deadline; user-notification decision; processor contact; remediation; approver;
closure date; evidence-retention date.

Incident owner and backup: `____________________`

Competent supervisory authority/contact details verified on: `____________________`

Tabletop exercise date, scenario, participants, and actions: `____________________`

## 9. Review and change gate

Run this checklist at least annually and before a material change.

- [ ] Controller, address, contact, imprint fields, and public legal text remain accurate.
- [ ] Processing inventory matches code, D1 schema, browser storage, logs, and external stores.
- [ ] Each legal basis and legitimate-interest assessment remains appropriate.
- [ ] Retention jobs ran successfully and exception/dispute holds are documented.
- [ ] Cloudflare DPA, subprocessors, plan, D1 facts, and transfer safeguards were rechecked.
- [ ] Access lists contain only current individually authorised people; leavers were removed.
- [ ] Export, correction, deletion, request-channel, and post-restore controls were tested.
- [ ] DPO, DPIA, and DSA conclusions were reconsidered against current facts.
- [ ] Review notice/action and reasoned-decision processes are staffed and tested.
- [ ] Security headers, CSRF, session revocation, password controls, dependency findings,
      diagnostics redaction, and incident contacts were reviewed.
- [ ] No analytics, advertising, tracking, non-essential device storage, external font,
      or new AI data flow was introduced without a documented legal/consent assessment.
- [ ] Public pages work without authentication at 320 px, 375 px, 768 px, and desktop,
      in light and dark mode.

Change-trigger review is mandatory for a new processor, international-transfer
change, new data category or purpose, retention change, analytics/tracking,
advertising, new public user content, automated decision/profiling, security
incident, material scale/audience change, or new legal guidance affecting the
service.

Review completed by / date: `____________________`

Findings and tracked actions: `____________________`

Final approval / date: `____________________`
