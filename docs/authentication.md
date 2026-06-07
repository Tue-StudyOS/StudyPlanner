# Authentication Approach

## Decision

Use a first-party email/password flow backed by Cloudflare D1 for credentials and stateless signed bearer tokens for API authentication.

## Why this approach

- no new production dependency is required
- favorites and personal progress need application-owned user state anyway
- the Worker can verify tokens without a `user_sessions` table lookup
- the D1 user schema stays small: `user_auth`, `user_state`, and `user_progress`

## Flow

1. the user registers with an email/username and password
2. the backend stores a PBKDF2-SHA256 password hash plus a per-user random salt in `user_auth`
3. on successful sign-in, the backend signs a bearer token with the Worker secret `AUTH_TOKEN_SECRET`
4. the token payload contains at least `username`, `iat`, and `exp`
5. the frontend keeps the token and sends it as `Authorization: Bearer <token>`
6. authenticated endpoints verify the signature and expiry, then load user state from D1
7. logout deletes the client-side token only

## Security rules

- passwords are never stored or logged in plain text
- `AUTH_TOKEN_SECRET` must be configured with `wrangler secret put AUTH_TOKEN_SECRET` and must never be committed
- authenticated requests require HTTPS in Cloudflare deployments
- CORS must allow the real frontend origin before production use
- token lifetime is configured through `AUTH_TOKEN_TTL_SECONDS`

## Stateless-token trade-off

Removing server-side sessions also removes immediate server-side revocation for already-issued tokens. A logout can only delete the client's local token; other devices remain authenticated until their token expires. Reintroduce a revocation table only if immediate all-device logout becomes a hard requirement.

## Scope

Included now:

- register
- sign in
- sign out as a client-side token deletion flow
- fetch current session/user
- store the selected study program including PO plus the start semester in `user_state`
- store favorites, semester plans, completed courses, and transcript review items as JSON in the reduced user tables

Not included yet:

- password reset emails
- email verification
- OAuth / SSO
- multi-factor authentication
- admin roles

## Cloudflare note

No manual Cloudflare identity-provider setup is required for this first-party auth flow. Apply migrations locally first, back up/export remote D1 databases, and only then apply remote database changes after explicit confirmation.
