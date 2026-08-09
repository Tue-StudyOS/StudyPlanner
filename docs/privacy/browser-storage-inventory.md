# Browser storage inventory

The canonical, test-enforced registry is
`frontend/src/shared/utils/browserStorageRegistry.ts`. Every new cookie,
`localStorage` key, or `sessionStorage` key must be added there with its owner,
purpose, data, duration, and section 25 TDDDG necessity decision before release.
The privacy notice must be reviewed whenever the registry changes.

StudyPlanner currently has no analytics, advertising, tracking pixel, external
font request, or other non-essential browser storage. Consequently the target
configuration does not use a consent banner. Introducing one of those features
requires a new consent/necessity assessment before implementation.

| Registry ID | Storage | Summary |
| --- | --- | --- |
| `auth-session` | HttpOnly cookie | Requested sign-in session; 30 days or logout/deletion |
| `legacy-auth-migration` | localStorage | Read-once migration token; immediately removed |
| `theme` | localStorage | Explicit light/dark preference |
| `catalog-layout` | localStorage | Explicit grid/list preference |
| `transcript-collapse-preferences` | localStorage | Explicit section-collapse preferences |
| `semester-tab-badge` | localStorage | Pending planner-change indicator |
| `private-session-cache` | sessionStorage | User-scoped responses; maximum 24 hours and cleared on logout/deletion |
| `transcript-import-candidates` | sessionStorage | In-progress transcript review; cleared on logout/deletion |
| `api-request-log` | sessionStorage | Recent client diagnostics; cleared on logout/deletion |
| `chunk-reload-guard` | sessionStorage | Deployment recovery timestamp for the current tab |

Private values are cleared by `clearPrivateBrowserData(username)`. Explicit UI
preferences remain until the user changes them or clears browser storage.

## Change checklist

- Update the canonical registry and this summary.
- Decide whether the storage is strictly necessary for a feature the user
  requested. If not, stop and complete the consent design before release.
- Update `/privacy` and the internal processing record when personal data,
  purpose, recipients, or duration changes.
- Add or update tests for denied/unavailable storage; the app must continue to
  work with only persistence or caching degraded.
- Check the built page for new third-party scripts, pixels, font hosts, and
  initial-load requests.
