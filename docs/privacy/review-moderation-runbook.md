# Public review notice and moderation runbook

## Classification gate

StudyPlanner hosts user-authored course reviews and therefore implements a
minimum electronic notice-and-action workflow without claiming a final Digital
Services Act classification. Before production deployment, the operator must
complete the DSA and micro/small-enterprise facts in
`compliance-record-template.md`, record the reviewer/date, and verify whether
any additional legal duties apply. This runbook is an operational baseline, not
that legal conclusion.

## Public rules and notices

The bilingual `/review-rules` page is linked from the review form before
publication. New reviews may select only lecturer names supplied by the public
ALMA catalogue. The backend rejects `lecturerCustomName`; migration `0036` does
not silently erase existing legacy values. Review those values under the
Article 14 assessment before any one-time deletion or anonymisation.

Anyone can select **Report review** beside a public review. The notice requires:

- the exact review id (attached by the UI) and a server-created snapshot;
- a category and concise rule/legal allegation;
- an explanation identifying the issue;
- a contact email for necessary follow-up; and
- an explicit good-faith confirmation.

The API returns an immediate `RN-<id>` receipt reference. It does not promise or
send an email. Public submission is limited to five notices per client per hour,
using the same non-reversible rate-limit key design as other public mutations.

## Moderator procedure

1. List notices with `GET /api/admin/review-notices`.
2. Compare the immutable public-content snapshot with the allegation. Do not
   use the notifier email unless follow-up is necessary.
3. Decide with `PATCH /api/admin/review-notices/<id>` and provide `action`,
   `category`, and a concise factual `reason`. Supported actions are `keep`,
   `hide`, `restore`, and `no_action` when the original review no longer exists.
4. The notice and review decision update in one D1 batch. The review author sees
   the action/reason on their own review and can submit a
   `moderation_redress` notice for another human review.
5. Keep notifier identity out of the author-facing reason. Escalate credible
   threats, urgent illegality, or active legal disputes through the operator's
   private incident procedure.

Direct legacy review moderation at `PATCH /api/admin/course-reviews/<id>` also
requires a supported category and a 10–1000 character reason; bare visibility
toggles are rejected.

## Temporary authorization boundary

The user explicitly deferred Phase 0. Consequently, this branch does **not** add
`REVIEW_MODERATOR_USERNAMES` or change `DIAGNOSTICS_ADMIN_USERNAMES`. All review
moderation calls go through the single `require_review_moderator()` boundary,
which temporarily retains the existing diagnostics-administrator check. Phase 0
must replace only that boundary and then independently test diagnostics and
moderation access before deployment.

## Retention and holds

Resolved notices are hard-deleted six calendar months after the decision.
Received/reviewing notices and rows with `retention_hold = 1` are excluded. A
hold is exceptional: record its case reason, owner, start date, and review date,
then remove it promptly when the dispute or legal obligation ends. Scheduled
logs expose only aggregate deletion counts.

Notifier access, correction, or erasure requests are handled through the manual
rights workflow using the receipt reference and verified contact email. Never
send the snapshot or notifier identity to the review author unless legally
required and approved.

Account deletion redacts non-held snapshots of that account's authored reviews
in the same transactional batch as account erasure. An active legal hold is the
only exception and must be reviewed under the documented case procedure.

Deleting one authored review similarly redacts its non-held notice snapshots and
deletes the live review in one transaction. A held snapshot remains only under
the same exceptional case procedure.
