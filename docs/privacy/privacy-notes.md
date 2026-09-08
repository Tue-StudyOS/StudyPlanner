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
- Until those facts are supplied, the public pages show explicit development
  placeholders and direct requests to the existing feedback form.

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
- Feedback: rating, message, source, and page path; no account link, although
  free text can contain personal information. Old rows are
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
- Access, correction, portability, objections, and manual deletion requests use
  the monitored privacy contact (the feedback form during development).
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
