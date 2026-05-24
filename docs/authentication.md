# Authentication Approach

## Decision

Use a first-party email/password flow backed by Cloudflare D1.

## Why this approach

- no new production dependency is required
- favorites and personal progress need an application-owned user record anyway
- the current Worker + D1 stack can support a small, explicit auth layer
- the session model stays portable if the project later moves to another identity provider

## Flow

1. the user registers with email, display name, and password
2. the backend stores a PBKDF2-SHA256 password hash plus a per-user random salt
3. on successful sign-in, the backend creates a random session token
4. only the SHA-256 hash of that session token is stored in D1
5. the frontend keeps the raw token and sends it as `Authorization: Bearer <token>`
6. authenticated endpoints resolve the session, load the user, and reject expired or revoked tokens

## Security rules

- passwords are never stored or logged in plain text
- session tokens are random, opaque, and revocable
- only hashed session tokens are stored in the database
- authenticated requests require HTTPS in Cloudflare deployments
- CORS must allow the real frontend origin before production use
- logout revokes the current session row explicitly

## Scope of the first implementation

Included now:

- register
- sign in
- sign out
- fetch current session/user
- store the selected study program and default regulation in the profile

Not included yet:

- password reset emails
- email verification
- OAuth / SSO
- multi-factor authentication
- admin roles

## Frontend behavior

- anonymous users can still browse the public catalog
- authenticated features such as persistent favorites and personal progress require sign-in
- the frontend restores the last session token from local storage on reload

## Cloudflare note

No manual Cloudflare identity-provider setup is required for this first-party auth flow.
Only the database migration and Worker deployment must be applied after the code changes.
