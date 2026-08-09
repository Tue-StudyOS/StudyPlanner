# Data-subject rights and account erasure runbook

Status: operator procedure — complete contact and evidence fields in restricted storage

## Self-service controls

An authenticated user can use the Account page to:

- download `studyplanner-data-export.json`, containing versioned account,
  profile/planning, progress, authored-review (including hidden state), and
  linked client-diagnostic data without password material or tokens;
- delete the account after supplying the current password, the session CSRF
  proof, and the explicit confirmation `DELETE`.

Account deletion is one transactional D1 batch. It detaches the username from
retained diagnostic events, removes username/email-derived failed-login limit
keys, and deletes `user_auth`; foreign-key cascades remove `user_state`,
`user_progress`, and authored `course_reviews`. It also redacts non-held notice
snapshots of authored reviews. Evidence under an active documented legal hold
is the only exception.
The response expires the session cookie, and the former stateless token can no
longer resolve an account.

Cloudflare documents D1 batches as transactions that roll back the complete
sequence when a statement fails. Keep all account-erasure mutations in
`execute_batch()`; do not replace them with separately awaited writes.

## Requests that need manual handling

Use the monitored privacy contact for correction, restriction, objection,
unusual access scope, requests from somebody who cannot sign in, or a request to
identify a specific unlinked submission. The public contact is pending verified
operator facts and must be inserted in `/privacy` before deployment.

1. Record receipt date, scope, handler, and the one-month response deadline in
   the restricted request log.
2. Verify identity proportionately. Ask only for evidence necessary to connect
   the person to the requested data and delete identity evidence promptly after
   verification.
3. Search D1 and every external data store recorded in the compliance record.
4. Apply the requested right or record the specific lawful reason for any limit.
5. Send the response securely and record action/response dates and any timely
   extension notice.
6. If D1 is restored to an earlier point, reapply every erasure received after
   that point before reopening the service.

Do not put request content, identity documents, postal addresses, or response
evidence in this repository.

## Data not linked to the account

IP-derived rate-limit keys and feedback do not carry an account identifier.
Under GDPR Article 11, do not collect extra identity data solely to make those
rows account-addressable. Explain that limitation to the requester. If the
person can precisely identify a feedback submission (for example by its content,
time, and page) or a later review notice reference, search and act on that record
through the restricted manual workflow.

## Recovery-history verification gate

Live rows are deleted immediately, but D1 recovery history can retain the prior
database state until its configured Time Travel period expires. Before deploying
the deletion UI and privacy notice, the Cloudflare account owner must record the
active plan and exact recovery period from the dashboard or
`wrangler d1 info studyplanner-db` in the restricted compliance record. The
coding environment had no Cloudflare API token on 2026-08-09, so this fact could
not be verified here and must not be guessed as 7 or 30 days.

Production verification must use a disposable account: add representative
state/progress/review data, export it, delete it, verify the live rows and cookie
are gone, and record the operator, time, result, and recovery-period disclosure.
