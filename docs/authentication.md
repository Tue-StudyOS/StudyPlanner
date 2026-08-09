# Authentication and request security

StudyPlanner uses first-party email/password accounts in Cloudflare D1. Sessions
are signed, stateless tokens stored in an HttpOnly cookie. Browser code receives
a session-bound CSRF proof, but never the session token itself.

## Important behavior

- Production cookies use `HttpOnly`, `Secure`, `SameSite=None`, and `Path=/`.
  Local HTTP development uses `SameSite=Lax` without `Secure`.
- Authenticated mutations require the `X-CSRF-Token` header.
- A valid legacy bearer token is promoted once and then removed from local
  storage.
- Changing credentials increments the account session version, invalidates old
  sessions, and issues a replacement cookie for the current browser.
- Logout clears the cookie and private per-user browser caches.
- Account deletion requires the current password, the exact confirmation
  `DELETE`, and CSRF protection. It deletes cascade-owned account data in one D1
  batch and expires the cookie. Data access requests are handled through the
  privacy contact route instead of a dedicated export API.

## Security rules

- Passwords use PBKDF2-SHA256 with a per-user random salt and are never logged.
- `AUTH_TOKEN_SECRET` is a required Wrangler secret and must never be committed.
- `ALLOWED_ORIGINS` is an explicit allow-list; credentialed CORS never uses `*`.
- Abuse-prone public endpoints use D1-backed fixed-window rate limits with
  hashed, non-reversible client keys.
- Diagnostics remove query strings and redact common credentials, headers,
  email addresses, transcripts, and grades. Entries are capped and old entries
  are removed during normal diagnostic requests.
- Security headers are configured in `frontend/public/_headers` and backend
  responses.

The active D1 binding remains `studyplanner-db`
(`80ca9092-ddc6-454a-b04a-8ccae85ef2f5`). Run `npm run db:verify-config` before
deployment. Do not recreate or swap the database.
