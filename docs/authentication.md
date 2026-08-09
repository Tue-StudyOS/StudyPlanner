# Authentication and public-request security

## Decision

StudyPlanner uses first-party email/password accounts in Cloudflare D1. A signed,
stateless session token is stored only in an HttpOnly cookie; browser code never
persists it in local or session storage. State-changing authenticated requests
also send a session-bound `X-CSRF-Token` header.

## Flow

1. Registration and login verify credentials and create a signed token with
   `username`, `iat`, and `exp` claims.
2. The Worker returns a `studyplanner_session` cookie with `HttpOnly`, `Secure`,
   `SameSite=None`, and `Path=/` in deployments. Local HTTP development uses
   `SameSite=Lax` without `Secure`.
3. The JSON response contains only the user and a CSRF proof derived from the
   signed session; the session token itself is never returned to application code.
4. The frontend sends cookies with `credentials: 'include'` and sends the CSRF
   proof for every authenticated `POST`, `PUT`, `PATCH`, and `DELETE` request.
5. `GET /api/auth/session` promotes a valid legacy bearer token once, then the
   frontend removes it from local storage. This preserves active sessions during
   the migration without keeping bearer storage as a long-term auth mechanism.
6. Logout clears the session cookie. Tokens remain stateless, so logging out in
   one browser does not revoke copies from other devices before expiry.
7. Authenticated users can export their account-linked data and delete their
   account with current-password, explicit-confirmation, and CSRF checks.
   Deletion runs as one transactional D1 batch and expires the cookie. Although
   tokens are stateless, a deleted account token becomes unusable because its
   user can no longer be loaded.

## Security rules

- Passwords use PBKDF2-SHA256 with a per-user random salt and are never logged.
- `AUTH_TOKEN_SECRET` must be configured with
  `wrangler secret put AUTH_TOKEN_SECRET --name studyplanner-api`; never commit it.
- `AUTH_TOKEN_TTL_SECONDS` configures the token lifetime.
- `ALLOWED_ORIGINS` must be an explicit frontend-origin allow-list. Cookie CORS
  responses enable credentials only for a matching allow-listed origin, never
  for `*`.
- Login, registration, feedback, AI catalog mutations, and client-error reports
  have D1-backed per-client fixed-window limits. The database stores only a
  SHA-256 digest of the Cloudflare-provided client IP.
- `GET /api/client-errors` requires authentication. Students receive only their
  own reports. Configure `DIAGNOSTICS_ADMIN_USERNAMES` as a comma-separated
  Worker variable to allow named operators to view the aggregated history.
  Operators can always use Cloudflare Worker logs and D1 directly.
- Browser and server diagnostics retain normalized paths without query strings.
  Both layers redact common email, credential/header, transcript, and grade
  patterns; response bodies and raw exception objects are not submitted as
  diagnostic detail. D1 diagnostics are deleted after 14 days and remain capped
  at 500 rows.
- Rate-limit keys are deleted daily once their applicable window has ended for
  more than 24 hours. See `docs/privacy/retention-operations.md` for boundaries,
  deployment gates, and verification.

## Scope

Included:

- registration, sign-in, sign-out, and session restore
- user profile, favorites, semester plans, completed courses, and transcript
  review state
- CSRF protection for authenticated mutations
- rate limits for public abuse-prone endpoints
- scoped diagnostics: own reports by default, aggregated reports for configured
  operators
- versioned self-service account export and atomic account deletion

Not included:

- password reset emails
- email verification
- OAuth / SSO
- multi-factor authentication
- immediate all-device session revocation

## Deployment

The active D1 binding is `studyplanner-db`
(`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`). Before deploying Worker changes, run
`npm run db:verify-config`, apply migrations to that existing database, and then
deploy the Worker. Do not switch to or recreate a database for this change.
