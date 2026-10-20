# masterCat Mapping

All regulation areas collapse to five universal categories stored as `masterCat` values inside `user_progress.completed_courses_json`.

## Category values

| Code    | Meaning                                                                |
|---------|------------------------------------------------------------------------|
| TECH    | Technical Computer Science (TI area, robotics)                         |
| THEO    | Theoretical Computer Science (ThI area, logics)                        |
| PRAK    | Practical Computer Science (PI elective area, labs)                    |
| INFO    | Applied Computer Science (elective CS area, general)                   |
| BASIS   | Foundations and broad elective / specialization buckets when needed    |

## BASIS as the single fallback bucket

The former `FOKUS` bucket is now folded into `BASIS`.

**Rule: when the correct category is ambiguous, assign BASIS.**

This applies to:
- Unmatched courses from "Professional Skills" / "Überfachliche Kompetenzen" sections in the ToR
- Unmatched courses from "Compulsory Area" sections in a BSc ToR

## Mapping by study area code (from `course_catalog.py`)

| Study area code(s)                        | masterCat |
|-------------------------------------------|-----------|
| `*TECH`                                   | TECH      |
| `*THEO`                                   | THEO      |
| `*PRAK`                                   | PRAK      |
| `INFO`, `INFO-INFO`, `ML-CS`, `*-INFO`    | INFO      |
| `INFO-FOKUS`, `ML-DIVERSE`, `ML-EXP`, `PROSEM`, `UEBK` | BASIS |
| `MATH`, `INF`, `INFO-BASIS`, `ML-FOUND`, `*BASIS` | BASIS |

## ToR section heading fallbacks (from `parseTranscriptPdf.ts`)

When a course cannot be matched to the catalog, the section heading in the PDF is used
to guess the masterCat. Matched courses always use the catalog-derived masterCat.

| Section heading (partial match)                          | masterCat |
|----------------------------------------------------------|-----------|
| "Practical Computer Science"                             | PRAK      |
| "Theoretical Computer Science", "Logics"                 | THEO      |
| "Technical Computer Science", "Robotik"                  | TECH      |
| "Mathematics"                                            | BASIS     |
| "Professional Skills", "Compulsory" (BSc mandatory area) | BASIS     |
| anything else                                            | INFO      |

## Compulsory assignment restrictions

Assignment eligibility is scoped to the selected degree and examination regulation,
not to a course title or its broad `masterCat`. Current catalog module options and
direct study-area links supplement the legacy regulation-mapping snapshot.
An individually compulsory mapping (`pflicht`/`mandatory`/`required` area metadata
or option status) excludes permissive cross-listings for that same program. Required
elective buckets, including ML foundations, do not make every eligible course
compulsory. A generic Pflicht ÜBK bucket also does not make its courses compulsory;
only explicit required course/module status restricts a ÜBK component. Blocked,
excluded and forbidden mappings never create assignment options or restrictions.

Only BSC_INFO_2021 maps the legacy compulsory MATH area to active INF (displayed
as MAIN), and only when MATH is absent and INF exists. Reference JSON ECTS remain
unchanged: legacy source codes and credits are not rewritten by this resolution.

Completed-course reads, progress and optimization canonicalize a single certain
compulsory destination without writing. Existing rows need a matching stored/catalog
title and every available stored code must agree with the catalog. A numeric ID or
generic/nonunique code alone is not evidence because reseeds reuse IDs. Uncertain
identities, unresolved compulsory destination codes and ambiguous invalid placements
are flagged and excluded from regulation-area credit until explicitly resolved;
no nonexistent destination is inferred. An existing confirmed destination is preserved.
Unchanged unresolved rows can be retained in bulk saves without preventing unrelated
edits; new invalid placements are rejected. Optimization starts those rows at zero
credit and reports any resolvable assignment as an explicit proposal.
No courses, grades, semesters or user-facing titles are removed or replaced.
Repairs persist on completed-course PUT (for an unchanged prior assignment) or
import writes. New incompatible compulsory selections are rejected. Unclassified
catalog-picked transcript courses can still use their official compulsory area;
anonymous external rows remain limited to flexible areas. General flexible-area
persistence and overflow presentation are separate follow-up work.
