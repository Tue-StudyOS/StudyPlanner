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
