# Transcript Import Scope, Privacy, and Acceptance Criteria

This note defines the first planning boundary for Transcript of Records PDF import.

## Goal

A signed-in student can upload a Transcript of Records PDF, review extracted course entries, and decide which entries should update personal study progress.

The feature must stay optional and must not block public catalog browsing or other signed-in features.

## V1 scope

### In scope

- authenticated upload flow for one transcript PDF at a time
- browser-side parsing of one transcript PDF at a time
- extraction of candidate transcript rows from the uploaded PDF
- matching candidate rows against known catalog courses
- explicit user review before any completed-course data is written
- partial import when some rows match and others remain unresolved
- clear status reporting for matched, uncertain, unmatched, and invalid rows

### Out of scope

- fully automatic import without user confirmation
- support for non-PDF file formats in v1
- bulk upload of multiple transcripts in one action
- long-term archival of original PDFs
- OCR-heavy support for low-quality scans in v1
- administrator tooling for manually editing another user's transcript

## Privacy requirements

### Data minimization

- keep the raw uploaded PDF only for the minimum time required to parse and review it
- do not keep the PDF permanently by default in D1 or browser storage
- persist only the data needed for confirmed completed-course records and import diagnostics

### User control

- the student must explicitly start the upload
- the student must explicitly confirm which extracted rows become completed courses
- the student must be able to cancel the review without changing saved progress

### Retention and deletion

- confirmed completed-course rows follow the same account data retention as existing progress data
- temporary parsing artifacts should be deleted automatically after processing or review expiry
- the student needs a clear way to remove imported completed-course entries later through the existing progress/transcript area

### Security and access

- upload and review endpoints must require authentication
- transcript data must only be accessible to the owning account
- parsing must run inside the controlled application boundary; no third-party transcript processor should receive student PDFs in v1 without explicit new approval
- in v1 the PDF may be parsed in the browser to avoid server-side retention of the raw file when practical
- validation must reject oversized files, unsupported MIME types, and malformed payloads at the API boundary

### Auditability

- imported completed-course entries should keep a source marker such as `transcript_import`
- uncertain matches should store enough context for the user to understand why manual confirmation is required

## Functional acceptance criteria

### Upload and parsing

- a signed-in user can select one PDF and start the import flow
- the upload flow validates file type and size before parsing
- the parser accepts the current English and German Tübingen Transcript of Records variants, including German decimal commas and semester/date values
- the UI shows success, validation, and processing errors clearly

### Review and matching

- extracted transcript rows are shown before any progress data is changed
- each row is labeled as matched, uncertain, or unmatched
- unfinished or failed transcript rows are ignored, while extracted rows without a catalog match remain visible for manual review
- the user can confirm, skip, or adjust uncertain rows before import

### Progress write-back

- only confirmed rows are written into account-based completed-course storage
- imported rows appear in the transcript/progress views without a manual refresh workaround
- duplicate protection prevents the same course from being imported twice without an explicit overwrite or merge decision

### Privacy and cleanup

- canceling the flow leaves saved completed-course data unchanged
- temporary raw upload data is not kept longer than necessary for the active review
- the user can later delete imported completed-course records through normal account features

## Non-functional acceptance criteria

- the upload flow remains optional and does not break the public signed-out experience
- parsing failures fail loudly with actionable feedback
- import processing stays scoped so one broken transcript does not affect another user's data
- the design leaves room for later improvements such as OCR or better matching heuristics without rewriting the confirmed-course storage model
