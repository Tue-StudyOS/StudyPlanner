# Retention operations

This runbook describes the automated deletion controls implemented by migration
`0035_retention_controls.sql` and the `studyplanner-api` scheduled Worker.

## Approved schedule in code

The Worker runs once per day at `03:17 UTC` and performs the following five
deletes as one D1 batch:

| Data | Maximum application retention | Boundary |
| --- | --- | --- |
| Client diagnostics | 14 days | Delete strictly older than 14 days; the existing 500-row ceiling remains an additional limit. |
| Product feedback | 6 calendar months | Delete strictly older than the SQLite calendar-month boundary. |
| Rate-limit keys | Applicable window plus 24 hours | Each fixed-window scope uses its own configured window length. |
| Hidden course reviews | 6 calendar months after the last update | Delete only hidden rows without an active `retention_hold`. |
| Resolved review notices | 6 calendar months after the decision | Delete only resolved rows without an active `retention_hold`; unresolved notices remain queued for a decision. |

Account, progress, active/public review, and catalogue tables are not cleanup
targets. Relevant diagnostic, feedback, rate-limit, and moderation paths also
remove expired rows opportunistically, but traffic is not the retention clock;
the scheduled job is the authoritative maximum-age control.

The scheduled log contains only the event name and five aggregate deletion
counts. It must never contain row values, identifiers, messages, or review text.

## Deployment gate

Do not apply the migration or perform a one-time production cleanup until the
operator has approved these periods and confirmed a recoverable D1 checkpoint.
Record the approver, date, checkpoint identifier, and the exact active D1 Time
Travel recovery period in the compliance record. A deletion can remain in
Cloudflare recovery history for that configured period even after it disappears
from the live database.

Deploy against the existing `studyplanner-db` binding only:

```bash
npm run db:verify-config
npm run db:migrate:remote
npm run deploy:backend
```

The first successful scheduled invocation removes existing expired rows, so no
separate broad or hand-written deletion command is needed. Capture only the
aggregate scheduled log as operational evidence.

## Local and post-deploy verification

Run the deterministic boundary and idempotence tests before deployment:

```bash
python -m unittest discover -s backend/tests -p "test_*.py"
```

Wrangler can expose the scheduled handler during a local runtime check without
changing the pinned compatibility date:

```bash
cd backend
npx wrangler dev --test-scheduled
```

In another terminal, invoke the local scheduled endpoint and verify that the
Worker logs aggregate counts only:

```bash
curl "http://localhost:8787/__scheduled?cron=17+3+*+*+*"
```

After deployment, verify the next cron invocation in Worker logs and inspect
counts and age boundaries without exporting record contents. If the job fails,
fix and rerun the same allowlisted cleanup; it is idempotent and its D1 batch
either succeeds as a unit or rolls back.

## Legal holds

Set `course_reviews.retention_hold = 1` only for an identified active dispute or
legal obligation. Record the reason, owner, start date, and review date in the
private case record. Remove the hold promptly when the reason ends; the next
cleanup then applies the normal six-month boundary.

The same rule applies to `review_notices.retention_hold`. The notice moderation
runbook describes the case record required for these holds.
