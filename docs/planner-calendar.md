# Date-aware planner calendar

The planner shows a dated Monday–Sunday week, with previous/next controls and a
native date jump. Navigation is not restricted to teaching weeks: semester breaks
and attached exams outside the nominal semester remain reachable. The initial
week contains today when it belongs to the selected calendar semester (summer:
April–September; winter: October–March), otherwise the semester's first day.
Only changing semester resets the week; tutorial/catalog changes do not save or
reset navigation. The onboarding tour uses the first teaching week as a preview
without changing the user's viewed week.

Desktop uses weekly columns; phone/tablet (up to 768px) uses dated day buttons and
a selected-day agenda so simultaneous appointments remain readable and reachable.
Saturday and Sunday appear when that week contains published appointments on
either day. Date-only appointments are separate from timed events. Desktop hours
expand beyond the usual 08:00–20:00 when needed. All planned courses retain detail
and remove controls below the calendar, including when the viewed week is empty.

## Source interpretation

- Structured `startsOn`/`endsOn` take precedence over dates in the day label.
  Strict ISO or German dates (including two-digit German years interpreted as
  2000–2099) are the fallback. Invalid/reversed dates are unresolved, not repaired.
- Weekly appointments respect inclusive bounds. Fortnightly (`14-täglich` /
  `14-tägig`, or English equivalents) appointments repeat every 14 days from the
  first matching weekday on or after their start, not by calendar-week parity.
- `Einzeltermin`, a single date, or equal bounds means one dated appointment.
- `Blockveranstaltung` expands the documented interval on weekdays only;
  `Blockveranstaltung + Sa und So` also includes Saturday/Sunday. No range means
  unresolved dates, not an invented weekly block.
- Exact `cancellationDates` suppress matching occurrences for every pattern.
  There is no inferred holiday or semester-break suppression.
- Weekly/fortnightly missing bounds use the existing approximate teaching-period
  rule (second Monday of April/October through last Saturday of July/February).
  Legacy slots without a rhythm may use a concrete weekday as weekly recurrence.
  An explicitly unknown/unsupported rhythm never implies weekly recurrence.
- Manual slots have only weekday/time fields and recur weekly within that same
  approximate teaching period. Their persisted IDs and membership are unchanged.
- Published `c.t.`/`s.t.` qualifiers remain timed appointments; the stated range
  and qualifier are retained without guessing a quarter-hour adjustment. ICS
  includes the original time in its description and normalizes 24:00 end times
  to midnight on the next civil date.
- Missing/invalid times never become midnight events. A known occurrence date is
  shown as date-only; unsupported recurrence is labeled unresolved and its source
  details remain reachable under “Unresolved schedule information”.
- Exam metadata has no time and is date-only. Matching date and exam type dedupe
  against scheduled exams, including hidden/cancelled ones, without removing
  distinct exam types on the same date. Generic scheduled exam labels match the
  ordinary exam type; unrelated descriptive types are retained.
- Hidden stable appointment IDs and legacy/source IDs apply to the whole series,
  before dated expansion; administrative `calendarRelevant=false` slots stay out.

## Export and other views

ICS export is the **full-semester plan**, never just the viewed week. The same
classification and strict dates drive export: weekly events retain RRULE/EXDATE,
fortnightly events use `INTERVAL=2`, and blocks/one-offs are finite dated events
with date-stable event identities when other block dates are cancelled.
Untimed known appointments and exam metadata are date-only events. Unsupported
recurrences and invalid dates are omitted rather than exporting invented events;
review the calendar's unresolved information before relying on an export.
Selection filtering remains unchanged. The catalog mini-grid, time filters and
manual-slot/tutorial selection utilities intentionally remain timeless previews.

Regression checks: `npm run test:frontend` at repository root, then
`npm run lint` and `npm run build` inside `frontend/`. Browser checks should cover
320px, 375px, 768px and desktop in both themes, crowded tutorials, empty weeks,
September/winter/weekend blocks, date-only exams, manual controls and tour preview.
