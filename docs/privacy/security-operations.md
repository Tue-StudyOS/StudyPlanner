# Security operations baseline

Status: implemented technical baseline plus operator checklist

This is an internal operating procedure. Store completed access lists, incident
records, recovery bookmarks, account identifiers, and contact details in the
restricted compliance store. Never commit them here.

## Implemented application controls

- Authentication tokens contain an account `session_version`. Migration
  `0037_session_revocation.sql` starts existing accounts and legacy tokens at
  version 0. A credential change increments the account version, invalidates
  other sessions, and issues the current browser a replacement cookie and CSRF
  proof. Deleting the account continues to invalidate every token.
- `AUTH_TOKEN_SECRET` is declared as a required Worker secret. It must be a
  unique production value set with `wrangler secret put`, not a plaintext
  Wrangler variable or repository/CI log value.
- The router applies CSRF protection before dispatching every authenticated
  `POST`, `PUT`, `PATCH`, or `DELETE` under `/api/me/` and `/api/admin/`, plus
  logout. A table-driven test covers every current state-changing route.
- Pages sends a restrictive CSP and baseline browser security headers. The CSP
  permits only the deployed API Worker as an external connection and permits
  only self-hosted fonts and scripts. Existing planner positioning uses React
  style attributes, so `style-src` currently needs `'unsafe-inline'`; reassess
  this exception if those styles are moved to classes.
- API and privacy HTML responses send HSTS, MIME-sniffing, framing, referrer,
  permissions, and deny-by-default CSP headers. Credentialed CORS is returned
  only for an allow-listed origin and never together with wildcard origin.
- Dependabot checks the frontend, MCP integration, backend Python metadata, and
  GitHub Actions weekly. Every update still requires normal review and tests.

The Phase 0 application-role change is deliberately outside this phase. The
current review-moderator authorization boundary remains unchanged until the
separately approved Phase 0 run.

## Access and secret review

Quarterly, and immediately after a team change:

1. Export/review Cloudflare and repository members in the restricted record.
2. Confirm every production operator uses an individual account and MFA.
3. Remove departed or unused members and reduce broad roles to the smallest
   Cloudflare policy that supports their current duties. Keep recovery access
   with at least two accountable people.
4. Review account-owned API tokens, CI credentials, Pages/Workers access, D1
   access, and the application privilege lists separately. Record reviewer,
   date, changes, and next review without recording credentials.
5. Confirm `AUTH_TOKEN_SECRET` is a Worker Secret and is not present in repo
   variables, build output, logs, tickets, or chat.

Cloudflare documents scoped member roles and warns that broad administrator
roles include substantially more privileges than ordinary product access:
<https://developers.cloudflare.com/fundamentals/manage-members/roles/>.
Cloudflare's secret guidance is:
<https://developers.cloudflare.com/workers/configuration/secrets/>.

### Secret rotation

For a planned rotation, generate a new independent high-entropy value in the
approved password/secret manager, run the config verifier, then update the
Worker secret and smoke-test login/session/logout. Do not copy a development or
other-service secret into production.

Rotating `AUTH_TOKEN_SECRET` invalidates every active session and CSRF proof.
Use that incident-wide action only when exposure is suspected or a planned
rotation justifies a coordinated logout. Notify users/operators when the forced
sign-in would otherwise look suspicious. A user's ordinary credential change
uses `session_version` and does not require global secret rotation.

## Password-hashing review

The current format is PBKDF2-HMAC-SHA256 with a random 16-byte per-user salt, a
256-bit derived key, and 310,000 iterations. The pinned Python Workers runtime
cannot use WebCrypto above 100,000 PBKDF2 iterations, so the reviewed code keeps
the stronger parameter through `hashlib` rather than silently lowering it.

Review the algorithm and measured production login cost annually and after a
runtime change. An upgrade must first add per-user algorithm and cost columns,
accept the old format for verification, and rehash successfully authenticated
passwords into the new format. Deploy that compatibility path before changing
the default. Never bulk-decrypt passwords (they are not reversible), lower the
cost merely for performance, or invalidate accounts without a recovery plan.

## D1 encryption and recovery

Cloudflare currently documents automatic AES-256 encryption at rest for D1
objects and TLS for Worker-to-D1, internal-node, HTTP API, and Wrangler traffic:
<https://developers.cloudflare.com/d1/reference/data-security/>. These are
processor controls, not a substitute for application access control.

D1 Time Travel is always on for production-storage databases and supports
point-in-time restore. The current limit is 7 days on Workers Free and 30 days
on Workers Paid. The operator must verify the active plan and database storage
version rather than assuming either period:
<https://developers.cloudflare.com/d1/reference/time-travel/> and
<https://developers.cloudflare.com/d1/platform/limits/>.

### Recovery drill

Run at least annually and after a material database/recovery change:

1. Verify `studyplanner-db` and its UUID with `npm run db:verify-config`; do not
   create, swap, or restore a database without explicit approval.
2. Record the current D1 storage version, plan, recovery duration, and bookmark
   in restricted storage. Select a non-production exercise or an approved
   maintenance window; a Time Travel restore overwrites the database in place.
3. Before any production restore, freeze writes, preserve the current bookmark,
   identify all erasure/correction/retention actions after the restore point,
   and obtain the accountable operator's approval.
4. Restore only the exact approved target, verify schema and representative
   non-sensitive records, then re-apply all later erasures and retention
   deletions before reopening writes. Re-run the scheduled cleanup and record
   aggregate counts only.
5. Record timing, result, gaps, previous/current bookmarks, and reviewer in the
   restricted drill record. Never copy a production export to an unmanaged
   laptop or keep it beyond the approved exercise period.

## Dependency and change routine

- Triage weekly Dependabot alerts and provider/runtime security notices.
- Prioritise actively exploited or remotely reachable issues; document the
  decision when an update is deferred because it is not applicable.
- Run backend tests, frontend tests/lint/build, MCP checks when affected,
  `npm run db:verify-config`, and Wrangler dry-runs before deployment.
- Recheck CSP connections, browser storage, processors, permission lists,
  retention jobs, and the public notices after any material architecture or
  data-flow change. Perform the same review at least annually even without a
  material change.

## Incident procedure

Keep a restricted incident log with: discovery time/source, affected system and
data categories, approximate people/records, containment actions, evidence
location, decision makers, risk assessment, notifications, recovery, and
follow-up actions. Do not paste personal data, secrets, raw request bodies, or
full database exports into tickets or chat.

1. **Triage and contain:** preserve minimal evidence; restrict access, disable a
   vulnerable path, revoke a scoped credential, or rotate the global signing
   secret as proportionate. Do not destroy evidence needed for the assessment.
2. **Assess:** determine confidentiality/integrity/availability impact,
   sensitivity, identifiability, scale, likely consequences, safeguards, and
   whether personal data was involved. Contact the controller and designated
   privacy/security adviser using the private contact list.
3. **Decide and document:** under GDPR Article 33, notify the competent
   supervisory authority without undue delay and, where feasible, within 72
   hours after awareness unless the breach is unlikely to risk people's rights
   and freedoms. Under Article 34, communicate without undue delay to affected
   people when high risk is likely, subject to the Article's exceptions. Record
   the reasoning even when no notification is made and obtain qualified advice
   when classification is uncertain.
4. **Recover and learn:** verify containment, restore safely, re-apply erasures
   after any restore, monitor for recurrence, and assign dated corrective work.

Authoritative legal text: Regulation (EU) 2016/679, especially Articles 33 and
34: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>.

### Restricted contact and decision record

- Incident lead / alternate: `____________________`
- Controller contact: `____________________`
- Technical containment contact: `____________________`
- Privacy/legal adviser: `____________________`
- Competent authority and submission route: `____________________`
- Awareness time / 72-hour decision deadline: `____________________`
- Risk conclusion, approver, and evidence location: `____________________`
