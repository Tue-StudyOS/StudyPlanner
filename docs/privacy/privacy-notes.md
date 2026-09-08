# StudyPlanner Privacy Notes

This is the practical privacy record for the four-person, non-commercial
student project. Keep it aligned with actual application behavior and the public
privacy notice; do not turn it into a separate compliance workflow.

The operator confirmed on 8 September 2026 that the group runs the service
independently of the university and anyone with the link can use it. Treat it as
a public service. See the [September privacy audit](privacy-audit-2026-09.md) for
verified implementation findings, remaining requirements and proportionate next
steps. These notes are not evidence that production obligations are complete.

## Operator and contact

- Responsible person: **TODO before production**
- Postal address: **TODO before production**
- Monitored privacy/review email: **TODO before production**
- The local legal preview uses **Max Mustermann**, **Musterstraße 1, 12345
  Musterstadt, Deutschland**, and **datenschutz@example.invalid**, as requested.
  These are fictional and must not be treated as the group's identity or mailbox.
- Edit `frontend/src/features/legal/legalOperator.ts` to replace the shared
  operator name, address lines and email on both legal pages. Keep `isPreview`
  enabled until real operator facts AND the outstanding notice sections have
  been completed. Disabling the preview does not establish compliance.
- The sample email is deliberately not a mailto link. A real mailbox becomes
  clickable once preview mode is disabled. The privacy page no longer sends
  rights requests through the rating-required product feedback form.
- Local preview: `http://localhost:5173/impressum` and
  `http://localhost:5173/privacy`. This change is for local review; do not deploy
  fictional operator details as a completed public legal notice.

## Hosting

- Frontend: Cloudflare Pages
- API: Cloudflare Workers
- Database: Cloudflare D1, binding `studyplanner-db`
- Cloudflare data-processing terms/DPA: account owner must verify acceptance and
  record the responsible person/date before production.

## Data and simple retention

- Account: username, email, password hash/salt, profile settings. Kept until
  account deletion or a valid manual deletion request.
- Study data: favorites, plans, progress, grades, transcript review state. Kept
  while the account exists.
- Reviews: content displayed without an author name but internally linked to its author. Authored
  reviews cascade on account deletion. Moderators can hide or delete content.
  Custom lecturer names are allowed and covered by the review rules/notice.
- Feedback: new submissions send only rating and message, without cookies or a
  referrer. They bypass authenticated client-error reporting, including on failure.
  The backend ignores incoming identity/page/source fields and writes `/` and
  `feedback_button` into the existing required metadata columns. Old rows can
  still contain route/source values; no historical records were rewritten.
  There is no account link, although free text can contain personal information.
  Hosting connection metadata and hashed-IP rate limiting still exist separately.
  Old rows are
  deleted opportunistically after roughly six months.
- Diagnostics: normalized route, error metadata, and temporarily the username.
  Secrets, cookies, tokens, email addresses, and obvious academic data are
  redacted. Old rows are deleted opportunistically after 14 days and the table
  is capped at 500 rows.
- Rate limits: pseudonymous hashed client/account keys and request windows. Stale rows are
  deleted during normal rate-limit checks.
- Cloudflare Workers observability is enabled at full sampling in the merged
  configuration. Its logs and backup retention are separate from D1 app cleanup;
  account settings and actual logged fields still need verification.

## Browser storage

- `studyplanner_session`: necessary HttpOnly authentication cookie, normally up
  to 30 days or logout/account deletion.
- Local storage: theme, catalogue layout, transcript collapse choices, and a
  small semester badge. A legacy auth token is removed during migration.
- Session storage: user-scoped API caches, transcript-import state, local API
  diagnostics, and a chunk-reload guard. Private user/session data is cleared
  on logout or account switch.
- No analytics, advertising trackers, or externally loaded Google Fonts were
  identified in the reviewed app paths. Provider features remain unverified.
  A banner is not automatically required, but each storage use needs a section
  25 TDDDG assessment; default preference writes and local diagnostics are not
  automatically necessary simply because they are first-party.

## Requests and review reports

- Account deletion is available on the Account page and requires password,
  explicit confirmation, and CSRF protection.
- Access, correction, portability, objections, and manual deletion requests are
  intended to use the operator mailbox. That mailbox is not yet supplied; the
  legal preview is not a functioning rights-request channel.
- A review's “Report” link opens the review rules, which tell the reporter to
  send the course/review details through the same contact form. The team can
  investigate and use existing hide/delete moderation.

## Database history

Migrations `0035_retention_controls.sql`, `0036_review_notice_moderation.sql`,
and `0037_session_revocation.sql` remain in the migration chain. Do not roll
them back: they may already have been applied. The `retention_hold` and detailed
moderation columns from 0035/0036 are unused. The legacy `review_notices` table
has no active workflow; account/review deletion only scrubs any linked snapshot
that may already exist. The session version from 0037 remains active.

## Deferred privileged access

The `DIAGNOSTICS_ADMIN_USERNAMES` and shared `test` account setup is deliberately
unchanged. It also grants review moderation through the same allow-list. The
September audit identifies replacement with named operator access as a priority;
the documentation review did not change production permissions.

## Small-team operating procedure

This is the proposed manual procedure for D4/D11; named handlers and an actual
mailbox still need assignment. Keep case details in a restricted private record,
never in this repository.

1. **Receive a request:** record receipt, handler, request type and response due
   date. Check the mailbox regularly, including during exams and holidays.
   Respond without undue delay, normally within one month; if a permitted
   extension is necessary, explain it within the first month.
2. **Verify and scope:** verify identity proportionately without asking for a
   password or routine ID copy. Include relevant account/profile, plan/progress,
   review and identifiable support/diagnostic data. Check legacy locations if
   relevant. Never provide another user's information or authentication material.
3. **Act and reply:** retrieve only the person's data, review the copy, and deliver
   securely. Use a machine-readable format when portability applies. Use existing
   account correction/deletion features where suitable; agree any additional
   database operation separately under the current no-database-change constraint.
   Record completion or explain any justified limitation and available remedies.
4. **Handle content reports:** identify the course/review, assess the complaint,
   use existing authorised moderation where appropriate, and record the reason
   and response. DSA scope and any additional procedural duties remain open.
5. **Handle incidents:** contain the problem, record affected data/people and
   assess risk. Notify the competent authority without undue delay and, where
   feasible, within 72 hours unless risk is unlikely; inform affected people
   where high risk requires it. Record the assessment even without notification.
6. **Review retention and access:** agree a reliable cleanup schedule before
   promising maximum durations. Inventory legacy data and backup locations first;
   no bulk deletion is authorised. Check access when a member leaves and reapply
   relevant deletions before making a restored database available.

Sources: [EDPB rights guidance](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en)
and [EDPB breach guidance](https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en).

## Local preview validation

The contact helper tests cover inert sample mailboxes and a configured real
mailto link. Browser review at 320px, 375px, 768px and desktop, in light/dark mode,
is still required: Edge was unavailable through the browser tools in this session
and the surface inventory was empty. The page uses the existing responsive
PageShell, wrapping text and breakable email addresses; this is not a substitute
for visual verification. The initial preview was local; the later release authorization is recorded below.

## Follow-up release checks

The session-reuse fix and anonymous-feedback changes passed 207 backend tests,
351 frontend tests (5 skipped), frontend lint/build and `npm run db:verify-config`.
The branch's existing catalog response headers are intentionally unchanged.
The unused frontend cookie-name constant and obsolete moderation phase comments
were removed. Historical SQL enum values and applied migrations remain intact;
new feedback ignores legacy source/page metadata instead of storing it.

On 8 September 2026, the operator approved merging and deploying this branch
and applying its existing migrations to the active production database.
Migrations 0035, 0036 and 0037 were applied successfully to studyplanner-db
without replacing or resetting it. Read-only checks confirmed unchanged account
and review counts, the new empty `review_notices` table, and initial session
versions for existing accounts.

The backend was deployed with `npm run deploy:backend` after the configuration
check. Worker version 4745fa61-9c6e-4ba5-ae2e-28c943754139 returned a healthy
response with a reachable database. The frontend release uses the authorized
non-fast-forward merge into main and push to the Pages Git integration.
The fictional contact information remains explicitly marked as a preview;
publication does not resolve the outstanding operator and legal-notice facts.
