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

- Shared contact for the four joint operators: **Yonatan Dankner**
- Postal address: **Hafengasse 11, 72070 Tübingen, Germany**
- Privacy contact email: **yonatan.dankner@gmail.com**
- On 10 September the user confirmed this is Yonatan's main mailbox and intended
  request channel. A separate project mailbox is not required by this plan.
  Delivery, actual handling and absence coverage have not been independently tested.
- Both legal pages share these details through
  `frontend/src/features/legal/legalOperator.ts`. At the user's request, the email
  is plain text, `yonatan.dankner (at) gmail.com`, without a mailto link or
  explanatory helper text. There is no raw address in the contact bundle.
  This deters basic scraping only; mailbox delivery and monitoring have not been
  independently verified.
- Public draft banners, inline assessment TODOs and the unused preview flags
  have been removed at the user's request. Track outstanding assessments here,
  rather than in visitor-facing development notes. Legal bases for catalog,
  reviews and feedback, deployed storage checks, and Cloudflare contracts/transfers
  still need completion; this copy cleanup does not establish those facts.
- The user expressly confirmed that all four decide together. Full identification
  and public contact addresses for Lena, Emre and Ben are still missing. Yonatan's
  address is not assumed to be a serviceable common address for everyone.
- Yonatan checks his main mailbox regularly and handles requests, technical
  exports/deletions and inaccurate/unlawful-content complaints. On absence the
  team assigns an available member internally; no fixed deputy is specified.
- The team commits to recording operation, access, deletion and request duties
  in writing. This record captures the confirmed allocation, not a completed
  Article 26 agreement. Remaining operation/access duties need allocation and
  the complete arrangement's essence must be made available to affected people.
- No company, VAT or DPO details were supplied or assumed.

## Hosting

- Frontend: Cloudflare Pages
- API: Cloudflare Workers
- Database: Cloudflare D1, binding `studyplanner-db`
- User-confirmed account owner: Ben; Free plan, Pages, Workers and D1 only, with
  no additional enabled products reported. Exact contractual identity and
  dashboard settings have not been independently verified. The repository has
  Workers observability enabled; that is distinct from an additional product.
- Cloudflare data-processing terms/DPA, transfer safeguards and provider retention
  remain unchecked for the account. Cloudflare states its DPA is incorporated
  into the Self-Serve Subscription Agreement; do not assume a separate signature
  is necessary or that account applicability has already been verified.

## Confirmed purposes and remaining legal assessment

The team uses non-public account/study data only for requested functionality and
secure operation, with no sale, advertising, research or AI training. Outside
the team, only engaged providers receive that data. Public course reviews and
catalog data are separately disclosed; this statement does not make them private.

The catalog supports study planning and reviews support exchange about courses.
Private contact details and confidential information must not be published.
Yonatan handles inaccurate or unlawful content reports. The user confirmed that
lecturers have not been informed. Assess Article 14 and provide the required
information unless a documented exception actually applies; no exception is
assumed simply because the ALMA source is public. The purpose-specific legal
bases and balancing assessment for catalog/review/feedback processing remain to
be completed. No notifications have been sent by the agent.

Sources: [GDPR Articles 14 and 26](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng),
[EDPB lawful processing](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en),
and [Cloudflare GDPR terms](https://www.cloudflare.com/trust-hub/gdpr/).

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
- Local storage: theme, catalogue layout and transcript collapse choices are
  saved only on an explicit change, not on initial rendering. The purpose is
  restoring a chosen display setting. A legacy auth token is removed during migration.
- Session storage: an unfinished, user-started transcript import is preserved
  against reload loss; the chunk-reload guard prevents repeated reloads after a
  deployment failure. Import data is removed on logout/account switch or when
  the candidate list becomes empty. Browser session restoration can retain it.
- API response caches, the bounded local diagnostic log and semester badge now
  live only in page memory. They reset on full reload; private memory is cleared
  on logout/account switch. Startup removes legacy session caches/logs and the
  persisted badge without reading their contents. Stored plans/grades in D1 are
  unaffected. Reloads fetch data again; SPA navigation still reuses responses.
- No analytics, advertising trackers, or externally loaded Google Fonts were
  identified in the reviewed app paths. Provider features remain unverified.
  The app-level assessment retains authentication, chosen display settings,
  protection of an in-progress import and recovery from deployment failures for
  their requested functional purposes under section 25(2) TDDDG. It removes
  unnecessary persistence rather than adding a banner. This is not proof that
  every provider-added feature is exempt: deployed network/storage checks and
  Cloudflare dashboard settings remain to be verified.

Browser-storage cleanup validation: unit tests cover no disk writes for API
caches/diagnostics, expiry and user isolation, logout memory cleanup, explicit
preference writes and unavailable storage. No browser was exposed by the browser
tool inventory in this session, so interaction checks at 320px, 375px, 768px and
desktop in light/dark mode remain outstanding. The cleanup changes persistence,
not layout. Publish through the existing Pages Git integration after merging
the completed branch into main with a non-fast-forward merge and pushing.

## Requests and review reports

- Account deletion is available on the Account page and requires password,
  explicit confirmation, and CSRF protection.
- Access, correction, portability, objections, and manual deletion requests use
  the operator email above, displayed on the public legal pages without login.
- A review's “Report” link opens the review rules, which now display Yonatan's
  shared contact and direct reports there by email, without a product rating or
  login. The team can investigate and use existing hide/delete moderation.

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

Yonatan is the confirmed handler for D4/D11 and technical exports/deletions;
absence cover is assigned by internal agreement to an available team member.
The procedure below supports that allocation. Keep case details in a restricted
private record, never in this repository. Assignment does not verify actual
administrator access or change the existing no-database-operation constraint.

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

The contact tests cover the supplied identity and an obfuscated display address
without a raw email or mailto. Browser review at 320px, 375px, 768px and desktop, in light/dark mode,
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
That release retained fictional preview contacts. The 10 September contact
update replaces them with the supplied operator details. A subsequent copy cleanup
removes public draft notices; outstanding assessments remain recorded internally.
The contact update is committed on a dedicated
branch; production publication uses a non-fast-forward merge into main and push
to the existing Pages Git integration.
