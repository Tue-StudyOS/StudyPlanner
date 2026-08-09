# StudyPlanner minimum DSGVO compliance implementation plan

Status: implementation-ready plan based on the repository state reviewed on 2026-08-09

Working branch: `feature/dsgvo-minimum-compliance`

Scope: the public StudyPlanner website, its Cloudflare Pages/Workers/D1 deployment, the public course-review feature, feedback and diagnostics, and the public AI/MCP integration

## 1. Goal and limits

The goal is the smallest coherent change set that makes StudyPlanner's actual data processing transparent, gives users a practical way to exercise their rights, removes avoidable third-party data flows, enforces retention, and closes the currently exposed diagnostics-administrator risk.

This plan deliberately does **not** add analytics, advertising, tracking, a generic cookie banner, a consent-management platform, a formal data-protection officer, or a database migration to another D1 instance unless a documented assessment shows that one is required. It also does not claim that code alone can make the service compliant: the legal operator must provide accurate identity/contact details, accept the Cloudflare DPA, approve the processing purposes and retention periods, and operate the rights and incident-response procedures.

This is an engineering and operational plan, not a substitute for a final legal review. Legal text must not be deployed with placeholders or facts that the operator has not verified.

## 2. Current repository findings

### 2.1 Privileged-access configuration finding

- `backend/wrangler.toml` currently sets `DIAGNOSTICS_ADMIN_USERNAMES = "test"`.
- A diagnostics administrator can read up to 200 client-error records across accounts. Records can include username, request URL, page path, status, error code, message and detail (`backend/src/services/client_error_log.py`).
- The same diagnostics-admin check is also reused for course-review moderation (`backend/src/services/course_reviews.py`). Removing `test` without separating the roles can leave review moderation without an operator.
- This finding does not by itself mean that the `test` account or authentication system is compromised. The corrective action is to remove its privileges, not to remove the normal QA account.
- Authentication tokens are stateless and last 30 days by default. Deleting an account invalidates its token because the user can no longer be loaded, but a password change does not currently revoke already issued tokens.

### 2.2 Public legal pages and routing

- The public `/privacy` route is not a site-wide privacy notice. The backend and MCP Worker each contain a duplicated, English-only AI-integration policy that says the integration collects no personal data.
- `frontend/functions/privacy.ts` proxies the public Pages `/privacy` route to the MCP Worker. Therefore, changing only `backend/src/router.py` would not reliably change the policy users see at `https://studyplaner.pages.dev/privacy`.
- The SPA has no `Datenschutz`, `Impressum`, legal footer, or public legal routes.
- AI metadata and several README/setup documents refer to the same `/privacy` URL. These references must remain valid after consolidation.

### 2.3 Personal data actually processed

The active account schema is defined by migration `0018_user_auth_state_progress.sql`:

| Area | Current data | Current lifetime/relationship |
| --- | --- | --- |
| Account | Username/login identifier, email, derived display name, password hash and salt, created/updated timestamps | Indefinite; no account-deletion endpoint |
| Study profile and settings | Study programme, examination-regulation version, starting/current semester, mobile layout, language, onboarding state | Indefinite while account exists |
| Study planning | Favourites, semester plans, selected courses, manual slots, notes and assignments | JSON in `user_state`; indefinite while account exists |
| Academic progress | Completed courses, grades, ECTS, semesters, transcript-review candidates/issues | JSON in `user_progress`; indefinite while account exists |
| Course reviews | Ratings, comment, semester, lecturer selection/custom lecturer name, hidden state, timestamps and author username | Publicly displayed without username, but internally linked to the account; cascades on account deletion |
| Feedback | Rating, free-text message, page path, source and time | Not linked to an account, but free text can still contain personal data; no age-based deletion |
| Server diagnostics | Method, URL, status, code, message, detail, duration, page path, username and time | Limited to 500 rows, not a maximum age |
| Rate limits | SHA-256 digest of an IP address or login identifier, scope, window and count | One row per key/scope, but stale rows are not deleted |

Cloudflare can additionally process request metadata such as IP address and timestamps when delivering Pages and Workers. This processing and the D1 service must be covered by the processor documentation and privacy notice.

### 2.4 Browser/device storage

Current first-party storage includes:

- `studyplanner_session`: 30-day HttpOnly authentication cookie, `Secure` in production and `SameSite=None` because the Pages frontend currently calls a different Workers origin;
- local storage for explicit UI choices such as theme, catalogue layout and collapsed panels;
- local/session flags used by the automatic feedback prompt;
- session storage for API diagnostics, private user-scoped caches and transcript-import candidates;
- a legacy bearer-token key that is read once, promoted to the HttpOnly cookie and removed.

There is no analytics or advertising code in the audited frontend. A consent banner is therefore not part of the target design. Every browser-storage operation still needs a recorded purpose and a necessity assessment under section 25 TDDDG.

### 2.5 Avoidable third-party requests

`frontend/index.html` loads Inter and Source Serif 4 from `fonts.googleapis.com`. This causes a browser request to Google before the user has chosen to interact with a third party. The fonts can be self-hosted and this external request can be removed.

## 3. Decisions and facts required from the operator

Implementation may start in parallel, but production legal pages must not be published until the following facts are supplied and recorded:

1. Full legal name of the controller/operator and legal form, if any.
2. Full postal address at which the operator is established/reachable.
3. A monitored privacy/contact email address. It must not be a temporary personal address that nobody checks.
4. Whether the service is operated by one person, a group, an association/company, or the University of Tübingen. Do not describe the university as operator or controller without an actual mandate.
5. Whether the service is offered commercially or contains advertising/affiliate activity, and which DDG/MStV imprint fields therefore apply (register, representative, VAT ID, responsible editor, etc.).
6. Number of people regularly handling personal data, whether the operator is a public body, and whether any high-risk/large-scale processing exists. These facts determine the DPO assessment.
7. The legal owner of the Cloudflare account and the date/version on which that party accepted Cloudflare's DPA.
8. The active Cloudflare plan and the output/dashboard facts for `studyplanner-db`: storage version, D1 jurisdiction, read-replication setting and Time Travel duration.
9. Whether any production exports, local backups, inboxes, issue trackers, spreadsheets or other stores contain user data outside D1.
10. The named, individual diagnostics operator and review moderator. Shared accounts such as `test` are not acceptable.

These facts belong in a private operator record where necessary. Only information legally required to be public should appear in the repository and site.

## 4. Minimum legal baseline

The implementation should use the following baseline, with final wording reviewed for the actual operator:

| Requirement | Minimum StudyPlanner response |
| --- | --- |
| GDPR Articles 5 and 6 | Record purpose, data categories, necessity and legal basis for every processing activity; minimise collection and apply storage limits. Use contract/service necessity for account and planning features where appropriate, and documented legitimate interests for proportionate security/diagnostics/moderation where appropriate. Do not describe ordinary use as blanket consent. |
| GDPR Articles 12-14 | Publish a concise, German-first site-wide privacy notice that identifies the controller and describes purposes, legal bases, recipients, transfers, retention and rights. Assess lecturer data obtained from ALMA or review authors under Article 14. |
| GDPR Articles 15-22 | Provide a monitored request channel, identity-verification procedure, one-month workflow, self-service export and self-service account deletion. |
| GDPR Article 28 | Ensure the actual controller has accepted the current Cloudflare DPA; retain a private copy/acceptance record and processor/subprocessor register. |
| GDPR Articles 30 and 32 | Maintain a proportionate record of processing activities and technical/organisational measures. Ongoing account processing is not merely occasional. |
| GDPR Articles 33 and 34 | Maintain a breach log and a procedure for risk assessment, authority notification within 72 hours where required, and user notification for likely high risk. |
| GDPR Articles 35 and 37; section 38 BDSG | Document the DPIA and DPO threshold assessments. Do not appoint a DPO merely because accounts exist, but reassess if the facts or product change. |
| Section 25 TDDDG | Keep only necessary first-party cookie/device storage without consent. Remove or redesign non-essential automatic-prompt storage. Add a change gate: new analytics/tracking cannot ship before a consent assessment. |
| Section 5 DDG and section 18 MStV | Publish an easily recognisable, directly reachable `Impressum` with the fields applicable to the actual operator. Add the named responsible editor only if the offering is journalistically/editorially designed. |
| DSA Articles 14, 16 and 17 | Because reviews store and disseminate user content, document the service classification. Unless counsel concludes that the reviews fall outside hosting-service obligations, provide clear review rules, an electronic notice/action mechanism and reasoned moderation decisions. Do not assume the ancillary-feature exception removes hosting-service duties; it concerns the definition of an online platform. |

## 5. Proposed processing matrix and retention

The final public notice and internal record must agree with implemented behaviour. The following periods are deliberately short and practical; the operator must approve them before implementation.

| Processing purpose | Proposed legal basis | Proposed retention |
| --- | --- | --- |
| Registration, authentication and account delivery | GDPR Article 6(1)(b) | Until account deletion; authentication cookie expires after 30 days |
| Study profile, favourites, plans, grades and transcript-review data | GDPR Article 6(1)(b) | Until the user deletes individual data or the account |
| Public course review and author ownership | GDPR Article 6(1)(b) for publishing at the user's request; moderation/security aspects under Article 6(1)(f), subject to documented balancing | Until author/account deletion or a final moderation decision; hidden content hard-deleted after 6 months unless needed for an active legal dispute |
| Feedback | GDPR Article 6(1)(f), product improvement; do not call it anonymous if content can identify someone | 6 months, then hard-delete |
| Client-error diagnostics | GDPR Article 6(1)(f), service reliability and security, with minimisation/redaction | 14 days, then hard-delete; keep the 500-row ceiling as a second limit |
| Abuse/rate limiting | GDPR Article 6(1)(f), security and availability | 24 hours after the applicable rate-limit window |
| DSA notices and moderation decisions, if implemented | GDPR Article 6(1)(c) and/or 6(1)(f), based on final classification | 6 months after closure, longer only for an active dispute/legal obligation |
| D1 recovery history | Article 6 basis follows the underlying data; security/availability under Articles 5 and 32 | Cloudflare Time Travel only: currently 7 days on Free or 30 days on Paid; disclose the verified active plan, and do not create indefinite exports by default |
| Private session cache/API log/transcript candidates in the browser | Same basis as the underlying feature; TDDDG necessity documented | Current tab/session only, maximum cache TTL 24 hours, and clear private entries on logout/account deletion |
| Explicit UI preferences | GDPR generally not relevant unless linkable; section 25 TDDDG still applies | Until the user changes/clears the preference; document each key as requested functionality |

Do not add a blanket inactive-account deletion rule unless the operator can notify users and support it. “While the account exists; erased on user deletion” is a meaningful retention criterion for data the user deliberately saves for later semesters.

## 6. Implementation phases

### Phase 0 — privileged-access correction

Execution note (2026-08-09): the operator explicitly deferred this phase for a
separate final run. Phases 1–5 do not depend on it. Phase 6 may add the review
notice and decision workflow while retaining the existing moderation
authorization temporarily, and Phase 7 may add its independent security
controls. The named-moderator authorization change and cross-role verification
remain part of Phase 0 and must not be implemented in Phases 6 or 7.

This is a high-priority configuration and authorization correction, but the current repository finding alone is not evidence of an active incident or compromised authentication. The risk is that the shared `test` account is named in a privileged allow-list. The account itself may remain available as a normal QA/demo user.

Target account model:

```text
test
Role: normal user
Purpose: shared QA/demo testing
Data: fake/non-personal test data only
Privileges: none

named_operator
Role: diagnostics administrator
Purpose: investigate production errors
Privileges: cross-account diagnostics only

named_moderator
Role: review moderator
Purpose: handle reported or abusive reviews
Privileges: review moderation only
```

Use individual accounts for privileged roles. One individual may hold both roles when that is operationally appropriate, but the permissions must remain independently configurable and testable.

#### Low-disruption implementation and deployment order

1. Introduce a separate `REVIEW_MODERATOR_USERNAMES` Worker variable and `is_review_moderator()` helper. Change course-review moderation to use that helper instead of `is_diagnostics_administrator()`.
2. Keep both privilege checks deny-by-default when their variables are missing or empty. Add focused tests proving that diagnostics access does not grant review moderation and review moderation does not grant diagnostics access.
3. Identify or create named individual accounts for the people who genuinely require diagnostics and/or moderation access. Give each account a unique password controlled by that person.
4. Configure the production Worker, for example:

   ```toml
   DIAGNOSTICS_ADMIN_USERNAMES = "named_operator"
   REVIEW_MODERATOR_USERNAMES = "named_moderator"
   ```

   Comma-separated individual usernames remain supported when more than one person needs a role.
5. Remove `test` from every privileged allow-list, deploy the Worker, and leave the `test` account and its existing login credentials unchanged.
6. Verify with at least the shared `test` account, a diagnostics operator and a review moderator that:
   - `test` can still sign in and use normal StudyPlanner features;
   - `test` cannot read cross-account diagnostics or access review moderation;
   - the diagnostics operator has only the intended diagnostics access;
   - the review moderator has only the intended moderation access.
7. Record the role assignments, deployment time, operator and verification result in the private security record. Document `test` as a shared, non-privileged QA/demo account that must contain only fake test data.
8. Update `backend/scripts/verify_cloudflare_config.py` so production verification rejects `test`, other documented shared/example usernames, or an empty required operator assignment in privileged lists. It must not reject the existence of an ordinary `test` account.

Do not rotate `AUTH_TOKEN_SECRET`, delete/disable `test`, change passwords, alter the database or modify normal account permissions solely for this allow-list correction. Rotate the secret or credentials only if separate evidence shows that a privileged session/token or secret was exposed; in that case, follow the incident-response procedure and communicate the resulting global logout.

General session revocation after a user's own credential change remains a defence-in-depth improvement in Phase 7, not a prerequisite for this correction.

Acceptance criteria:

- `test` remains usable as a normal shared QA/demo account and contains no real personal data;
- production contains no shared/example username in either privileged allow-list;
- diagnostics and moderation permissions are separately configured, deny-by-default and independently tested;
- normal users and other team members' accounts are unaffected;
- `npm run db:verify-config` rejects a privileged shared/example account regression without rejecting ordinary QA accounts;
- no authentication-secret rotation or user logout is required unless an actual exposure is identified.

### Phase 1 — verified legal/operator facts and internal compliance record

Create a concise, non-secret repository template at `docs/privacy/compliance-record-template.md` containing:

- record of processing activities: controller, purposes, data subjects, data categories, recipients, transfers, retention and TOM summary;
- processor/subprocessor register and Cloudflare DPA acceptance fields;
- legitimate-interest assessments for diagnostics, rate limiting, feedback and moderation;
- DPO threshold assessment and DPIA screening outcome;
- DSA classification assessment for course reviews;
- data-subject request procedure and request log fields;
- data-breach triage, containment, documentation and 72-hour decision procedure;
- annual/change-trigger review checklist.

Keep signed DPAs, personal addresses not intended for publication, incident evidence, request identity documents and detailed infrastructure credentials outside the public repository in restricted storage. The template must say where the operator keeps those records, without naming secrets.

Cloudflare checks:

- confirm the legal Cloudflare customer accepted DPA version 6.4 (effective 2026-04-03) or the then-current replacement;
- retain the DPA and subprocessor-list review date;
- run/read `wrangler d1 info studyplanner-db` or the dashboard to record jurisdiction, storage version, plan and replication;
- do **not** create or swap D1 databases as part of this minimum work. The project guardrails require explicit human approval for another DB cutover. If an EU-jurisdiction database is later chosen, plan it as a separate migration with preservation of all user data and course-number keys.

Acceptance criteria:

- every row of the processing matrix has an owner, legal basis, retention and implemented control;
- DPA acceptance and actual D1 facts are evidenced privately;
- DPO/DPIA/DSA outcomes are dated and signed off by the operator.

### Phase 2 — public Datenschutz and Impressum

#### Routing and components

Add public SPA routes:

- `ROUTES.privacy = '/privacy'`;
- `ROUTES.imprint = '/impressum'`;
- optionally keep `/datenschutz` as a redirect to `/privacy`.

Add lean components under `frontend/src/features/legal/` and a compact legal-link footer/menu that remains reachable on phone and desktop. The pages must be usable without login and must not be blocked by `StudySetupGate`. Ensure the feedback button does not cover the legal links at 320 px width or with a mobile safe-area inset.

Remove `frontend/functions/privacy.ts` so the Pages SPA fallback owns public `/privacy`. Keep the MCP Worker's direct policy endpoint only if an integration needs the worker-specific URL; remove misleading duplicate site-wide claims and point public AI metadata/listings to the consolidated public notice. Update:

- `backend/src/router.py` and `backend/src/services/ai_catalog.py`;
- `integrations/studyplanner-mcp/src/index.ts`;
- `README.md`, `backend/README.md`;
- `docs/ai-integrations-setup.md`, `docs/cloudflare-development.md`, `docs/cloudflare-setup.md`, and `docs/cloudflare-runtime-config.md`.

#### Privacy notice content

Publish a German-first notice, with an English version only if it can be kept in sync. It must cover:

1. Controller identity, postal address and contact; DPO contact only if one is actually appointed.
2. Hosting and delivery through Cloudflare Pages/Workers/D1.
3. Account/authentication data, password hashing, the 30-day session cookie and CSRF protection.
4. Study profile, favourites, semester plans, completed courses, grades and transcript-review data.
5. Public course reviews: public display is anonymous, but the backend retains the author username for ownership/moderation; lecturer data and public visibility; report/moderation process.
6. Feedback: no account field is stored, but page path and free text are stored and the text may contain personal information.
7. Security/rate limiting: non-reversible SHA-256 keys derived from IP or login identifier, scopes and short retention.
8. Client diagnostics: exact fields after minimisation, user association, access restrictions and 14-day retention.
9. Browser/device storage, item by item, including purpose and duration.
10. AI/MCP integration as a clearly separated section: user-entered search terms/course identifiers, Cloudflare delivery metadata and boundaries with OpenAI/Anthropic services chosen by the user.
11. Recipients/categories of recipients, Cloudflare DPA and relevant international-transfer safeguards based on verified facts.
12. Retention table, D1 Time Travel residual period and absence/presence of additional backups.
13. Rights to access, correction, erasure, restriction, portability and objection; request contact; one-month response; complaint to the competent Baden-Württemberg authority.
14. Whether providing account fields is required for the requested account service and the consequence of not providing them.
15. No analytics/advertising/profiling or automated decisions with legal/similar significant effect, if still factually true.
16. Last-updated date and material-change procedure.

Do not use “by using this website you consent.” Do not call public reviews or feedback completely anonymous where re-identification or self-identifying free text remains possible.

#### Impressum content

Use actual operator facts. At minimum include the full name, full address and a monitored email/contact route. Conditionally add legal form, representative, register/registration number, VAT/economic ID, supervisory authority or editorially responsible person only when applicable. State clearly that course information comes from university sources but the service is not operated by the University of Tübingen unless that statement is verified.

Acceptance criteria:

- `/privacy` and `/impressum` return 200 directly and after browser refresh;
- both are reachable in at most two interactions from every page and without authentication;
- no placeholder such as `[NAME]`, `TODO` or “StudyOS Team” remains;
- German text wraps at 320, 375, 768 px and desktop widths in light/dark mode;
- the public AI privacy URL still resolves and its statements match actual processing.

### Phase 3 — self-host fonts and finish the device-storage inventory

1. Download only the WOFF2 weights/styles actually used for Inter and Source Serif 4 into `frontend/src/assets/fonts/`.
2. Add the applicable OFL licence/attribution file.
3. Declare local `@font-face` rules in `frontend/src/index.css` and remove Google `preconnect`/stylesheet links from `frontend/index.html`.
4. Remove the automatic feedback pop-up and its persistent submitted/seen storage flags. Keep the user-invoked feedback button. This avoids storing a non-essential prompt preference and reduces dark-pattern risk.
5. Add one central registry/document for every cookie/localStorage/sessionStorage key: owner, purpose, data, duration and TDDDG necessity decision.
6. Add `clearPrivateBrowserData(username)` to remove user-scoped session cache, transcript candidates and API-request diagnostics on logout and account deletion. Keep explicit, non-account UI preferences unless the user chooses to clear them.
7. Remove the legacy bearer-token migration path after a documented sunset if production no longer needs it; until then, preserve the current read-once-and-delete behaviour.
8. Add a review checklist/CI assertion that a new third-party script, analytics SDK, pixel, font host or non-essential storage key cannot be introduced without updating the inventory and consent assessment.

No cookie banner is accepted when all of the following remain true:

- initial page load makes no analytics/advertising/third-party-font request;
- the auth cookie is set only to deliver the login requested by the user;
- remaining local/session storage is necessary for an explicitly selected preference or the current requested session/function;
- the privacy notice describes it accurately.

Acceptance criteria:

- network inspection shows no request to `fonts.googleapis.com` or `fonts.gstatic.com`;
- the site works with all storage denied, apart from loss of persistence/caching;
- logout removes private cached academic and diagnostic data;
- the inventory matches an automated search for storage APIs and cookie creation.

### Phase 4 — data export, erasure and rights workflow

#### Backend

Create `backend/src/services/user_privacy.py` with explicit return types and small functions for export and deletion.

Add authenticated endpoints, with CSRF protection on the state-changing deletion endpoint:

- `GET /api/me/data-export`: return a versioned JSON download with account identity/profile, user state, progress, authored reviews including hidden status, and diagnostics linked to that username. Exclude password hash/salt, auth tokens, other users and internal secrets. Send `Cache-Control: no-store` and a safe attachment filename.
- `DELETE /api/me/account`: require the current password plus an explicit confirmation value in the request body; update/detach client diagnostics and delete account-keyed rate-limit rows, then delete `user_auth`. Foreign-key cascades remove `user_state`, `user_progress` and `course_reviews`. Clear the session cookie in the response.

Deletion must be atomic. Add a tested D1 batch helper if the runtime binding supports transactional `batch()`; otherwise redesign the schema/migration so one parent delete and foreign-key actions cover all account-linked data. Do not leave a partially deleted account when one statement fails.

For IP-derived rate-limit rows and feedback, the service cannot associate a row with an account from the username alone. Document this under GDPR Article 11 rather than collecting extra identifiers solely to make those records account-addressable. Provide a manual route for a user who can precisely identify a feedback submission/review notice.

#### Frontend

Add a “My data” section to `AccountPage.tsx`:

- `Export my data` downloads the server JSON without placing its contents in local storage;
- `Delete account` opens a mobile-safe destructive confirmation dialog, explains immediate live-data deletion and the verified D1 recovery-history period, asks for current password and explicit confirmation, and does not use misleading urgency;
- after success, clear auth state and private browser data and navigate to a public page.

Publish a manual rights process in the privacy notice and internal record for correction, restriction, objection, unusual access scope and requests from people who cannot sign in. Verify identity proportionately and delete identity evidence promptly. Log request received date, verification, action, response date and any extension in restricted operator storage.

Acceptance criteria:

- export contains all account-linked categories and no credentials/secrets;
- export and deletion reject unauthenticated, wrong-password and missing-CSRF requests;
- deletion removes state/progress/reviews, handles diagnostics as documented, clears the cookie and invalidates the old token;
- failure injection proves no partial deletion;
- a throwaway production account can export and delete successfully;
- privacy notice and UI state the verified recovery-history residual period.

### Phase 5 — enforce retention and diagnostic minimisation

Implementation note (2026-08-09): the migration, daily scheduled cleanup,
opportunistic cleanup, diagnostic redaction, tests, and operating runbook are
implemented on the working branch. Applying migration `0035` and deploying the
cron remain gated on operator approval of the periods and confirmation of a
recoverable production checkpoint; no one-time production deletion was run.

Add a migration after `0034` with indexes needed for age deletion and, if required, review-notice tables. Apply a one-time cleanup of already expired feedback, diagnostics and rate-limit rows only after the operator has approved the periods and a recoverable production backup/checkpoint exists.

Implement one daily scheduled cleanup path, compatible with the pinned Python Workers runtime, that:

- deletes `client_error_log` rows older than 14 days;
- deletes `user_feedback` rows older than 6 months;
- deletes `request_rate_limits` rows more than 24 hours past their window;
- hard-deletes hidden reviews/closed notices after their approved period unless an explicit active-dispute hold exists;
- returns/logs only aggregate deletion counts, not record contents.

Keep opportunistic cleanup on relevant write/list paths as defence in depth, but do not rely on traffic for the maximum age. Do not raise `backend/wrangler.toml`'s `compatibility_date`; the documented cold-start failure guardrail still applies.

Minimise diagnostics before storage:

- store a normalised API path instead of a full URL with query/fragment unless an allowlisted query field is demonstrably required;
- redact emails, tokens, cookie/header values, transcript text and other obvious secrets/personal fields from `message` and `detail` on the client and again on the server;
- cap lengths as today and keep both age and count limits;
- stop sending response bodies or raw exception objects when a stable error code/message is enough;
- allow administrators to see only the fields needed for diagnosis and log/record privileged access in the private operating procedure.

Acceptance criteria:

- time-controlled tests prove every retention boundary;
- cleanup is idempotent and cannot delete account/catalog tables;
- redaction tests cover URL queries, email-like strings, bearer tokens, cookies and transcript/grade examples;
- no record older than the maximum survives a successful scheduled run.

### Phase 6 — public-review and DSA minimum

Implementation note (2026-08-09): the bilingual rules, catalogue-only lecturer
selection, public notice/receipt flow, reasoned decisions, author redress path,
six-month notice retention, tests, and operating runbook are implemented on the
working branch. The operator's final DSA/micro-enterprise classification and the
production migration remain approval gates. The dedicated moderator allow-list
is intentionally not implemented because the operator deferred Phase 0; all
moderation uses the documented temporary authorization boundary until then.

First record the legal classification and the micro/small-enterprise facts. Pending a contrary reviewed conclusion, implement the following minimum hosting controls:

1. Add concise German/English review rules reachable before publishing: course-relevant experience only; no unlawful content, insults, threats, sensitive personal data or unverifiable accusations; explain public visibility, author linkage, moderation grounds and redress contact.
2. Remove free-text custom lecturer names for new reviews. Permit only names already supplied by the public ALMA catalogue, unless the Article 14 source/transparency assessment supports a broader design. Review existing `lecturer_custom_name` values before deletion/anonymisation.
3. Add a `Report` action to each public review and an electronic notice form that captures the exact review, reason/legal allegation, explanation, notifier contact details where required and good-faith confirmation. Do not require a StudyPlanner account to submit a notice.
4. Store notices separately from public reviews, restrict access to named moderators, rate-limit abuse, acknowledge receipt and retain only for the approved period.
5. Expand moderation decisions beyond `is_hidden`: record category, concise reasons, human moderator, decision time and status. Provide the affected author a statement of reasons and a simple review/contact path. Do not expose the notifier's identity to the author unless legally necessary.
6. Make moderation access use `REVIEW_MODERATOR_USERNAMES`, never diagnostics privileges.
7. Document how obviously unlawful/abusive content, disputes and lecturer correction requests are handled. Keep evidence only as long as needed.

If the operator cannot staff notice/action and reasoned moderation, the minimum safe launch choice is to disable new/public course reviews until the process is available. Do not leave public user content online with only an undocumented hide toggle.

Acceptance criteria:

- anyone can submit a sufficiently precise notice electronically;
- the reporter receives acknowledgment and the decision/redress information;
- the author receives the moderation reason without the reporter's private details;
- only the author edits/deletes their review and only a named moderator restricts it;
- hidden/reported content follows the retention policy;
- long German report reasons and moderation notices work on 320 px screens.

### Phase 7 — technical and organisational security baseline

Update the internal TOM section and implement only missing, proportionate controls:

- least-privilege named Cloudflare accounts with MFA and periodic access review;
- unique production secrets through Cloudflare secrets, never repository variables;
- session revocation on credential change and incident-wide secret rotation procedure;
- CSRF tests for every state-changing account/admin endpoint;
- password-hashing parameter review and documented upgrade path;
- D1 encryption in transit/at rest facts from current Cloudflare documentation;
- dependency/security update routine;
- production backup/restore drill that respects deletion retention;
- security headers for Pages and Worker responses, including a tested CSP compatible with the actual API Worker origin and self-hosted fonts;
- incident log, containment contacts, risk assessment and notification decision tree;
- annual and material-change review of privacy notice, storage inventory, processors, permissions and retention jobs.

Do not publish sensitive TOM implementation details that would aid attackers. The public privacy notice can describe controls at a high level.

## 7. Test and verification plan

### Automated backend tests

- privilege separation and deny-by-default config;
- session-version invalidation after credential update;
- export field inclusion/exclusion and `no-store` headers;
- account deletion authentication, CSRF, atomicity, cascades and cookie clearing;
- retention cleanup boundaries and idempotence;
- diagnostic URL/detail redaction;
- review notice/action permissions, acknowledgment data and reason visibility;
- migration tests against an empty database and a copy of the current schema.

Run:

```text
python -m unittest discover -s backend/tests
npm run db:verify-config
```

### Automated frontend tests

Extract pure utilities and test them with explicit `.ts` runtime imports, following `AGENTS.md`:

- legal route/link definitions and placeholder detection;
- browser-storage registry and private-data clearing;
- export filename/download handling;
- account-deletion confirmation state;
- review-report validation and moderation reason formatting;
- removal of feedback auto-prompt logic;
- privacy content schema contains every required processing category.

Run from `frontend/`:

```text
npm test
npm run lint
npm run build
```

If MCP policy/metadata code changes, also run from the repository root:

```text
npm run test:mcp
npm run build:mcp
```

### Manual/browser verification

Check 320, 375, 768 px and desktop widths in light/dark mode:

- legal links and pages are reachable without login and with an incomplete account setup;
- no clipped legal tables, confirmation dialogs, report forms or buttons;
- keyboard focus and screen-reader names for legal links, export, deletion and reports;
- no request to Google Fonts or unlisted third parties;
- cookie set only after authentication and correct flags on the actual Pages-to-Workers topology;
- private session data removed on logout/deletion;
- public reviews never reveal username;
- moderator/report workflows expose only role-appropriate fields.

### Production smoke test

After deploy, verify at minimum:

- `GET https://studyplaner.pages.dev/privacy`;
- `GET https://studyplaner.pages.dev/impressum`;
- AI metadata privacy URL;
- font network origins;
- named moderator versus diagnostics operator access;
- export/delete with a disposable account;
- scheduled cleanup invocation/result;
- Cloudflare Pages/Worker logs do not contain request bodies or exported personal data.

## 8. Deployment order and rollback

1. Obtain operator facts and DPA evidence. Phase 0 is explicitly deferred to a separate final run; do not change privileged access while completing the other phases.
2. Complete Phases 1–5. Phase 6 and Phase 7 must retain the current moderator authorization until the separately authorised Phase 0 run.
3. Merge compatible schema/backend changes, apply migrations to local D1 and run all tests.
4. Run `npm run db:verify-config` before every remote migration/deploy.
5. Apply the D1 migration to the existing `studyplanner-db` in place. Do not create/swap databases.
6. Deploy backend Worker, then MCP Worker if changed, then Pages frontend/legal routes.
7. Verify production behaviour and only then run the one-time expired-data cleanup.
8. Keep the implementation on this one shared feature branch with one commit per logical phase. Merge to `main` once using a non-fast-forward merge, as required by `AGENTS.md`.

Rollback principles:

- legal pages may be corrected forward immediately, but never roll back to the known misleading AI-only site notice;
- application code can be rolled back while retaining additive schema columns/tables;
- do not restore a D1 Time Travel point merely to undo application code, because doing so can resurrect deleted user data and lose new writes;
- if a restore is unavoidable, assess and re-apply erasure requests received after the restore point before reopening service.

Deployment access may be unavailable to the coding agent. In that case, the handoff must state the exact pending commands and which human must complete the Cloudflare dashboard/DPA/credential actions.

## 9. Definition of done

The minimum compliance work is complete only when all of the following are true:

- no shared/example account has diagnostics or moderation privilege in production;
- the actual operator/controller and monitored contact are publicly identified;
- `/privacy` accurately covers the entire service and `/impressum` contains applicable verified facts;
- legal pages are permanently reachable without login on phone and desktop;
- Google Fonts and other unneeded third-party initial-load requests are gone;
- no consent banner is present because no consent-requiring storage/tracking is deployed, and that conclusion is documented;
- users can export and delete their account data, and a manual one-month rights workflow exists;
- account deletion covers reviews and diagnostics as documented, private browser data is cleared, and recovery-history residuals are disclosed;
- feedback, diagnostics, rate-limit rows and hidden/reported content have enforced maximum ages;
- review author linkage is described honestly and notice/action moderation is operational (or reviews are disabled);
- Cloudflare DPA, subprocessor, transfer, D1 jurisdiction and backup facts are recorded;
- ROPA, LIA, TOM, DPO/DPIA screening and breach procedure are approved and owned;
- automated tests, frontend lint/build, mobile/dark-mode checks and production smoke tests pass;
- documentation matches deployed code and contains no placeholders.

## 10. Primary sources used for this plan

- GDPR, especially Articles 5, 6, 12-14, 15-22, 28, 30, 32-35 and 37: <https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng>
- Section 5 DDG: <https://www.gesetze-im-internet.de/ddg/__5.html>
- Section 25 TDDDG: <https://www.gesetze-im-internet.de/ttdsg/__25.html>
- Section 38 BDSG: <https://www.gesetze-im-internet.de/bdsg_2018/__38.html>
- DSA, especially Articles 14, 16 and 17 and the online-platform/ancillary-feature definition: <https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng>
- German media authorities' current imprint guidance: <https://www.die-medienanstalten.de/aufgaben/aufsicht/impressumspflicht/>
- Cloudflare Customer DPA, version 6.4 effective 2026-04-03 at review time: <https://www.cloudflare.com/en-gb/cloudflare-customer-dpa/>
- Cloudflare D1 data location/jurisdiction: <https://developers.cloudflare.com/d1/configuration/data-location/>
- Cloudflare D1 Time Travel and backup retention: <https://developers.cloudflare.com/d1/reference/time-travel/>
- Cloudflare D1 data security: <https://developers.cloudflare.com/d1/reference/data-security/>
