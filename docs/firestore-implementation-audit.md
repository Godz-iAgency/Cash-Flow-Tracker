# Firestore implementation audit — October 4, 2026

## Inspection and scope

The existing app already supplied accounting, credit-card purchases/payments, transfer exclusion, independent classification/ownership, balance comparisons, audit history, mobile scrolling, and legacy Sheets storage. These working features were extended rather than replaced. Accounting formulas and original records were not changed.

## Files changed

- Server: server/firebase.ts, server/firestore.ts, server/storage.ts, server/index.ts, server/sheets.ts.
- UI and import: src/firebaseClient.ts, src/CloudSetup.tsx, src/App.tsx, src/api.ts, src/theme.css, shared/backup.ts.
- Configuration: firestore.rules, .env.example, package.json, package-lock.json, playwright.config.ts.
- Checks: tests/firestore.test.ts, tests/sheets-export.test.ts, tests/security.test.ts, tests/browser/cloud.spec.ts.
- Documentation: README.md, docs/firestore-setup.md, this report.

## New functionality and schema

Owner-only verified Google sign-in; Firestore transactions that atomically save records and immutable audit evidence; preservation of original record ordering; a reviewed, first-import-only backup screen; and explicit dated Google Sheets snapshot exports. Legacy local and Sheets modes remain functional.

Firestore adds cashFlowUsers/{verified UID}, the existing fourteen record collections, and metadata/state for schema/revision/import evidence and record order. Financial record fields keep their existing meanings. Sheets exports use the existing fourteen schemas in newly named dated report tabs. Existing tabs and financial cells are preserved. No live tabs or financial records were created during this work.

## Calculations

No new financial calculations. All cents-based accounting and discrepancy formulas are reused. Import screens add record counts and known-opening-balance counts. A nonzero reconciliation discrepancy stays flagged; no financial records are adjusted to make a balance match.

## Verification

- Complete unit/security suite: 41 passed. Covers all seven requested accounting invariants, owner restrictions, exact backup preservation, duplicate/partial import refusal, atomic audit writes, stale edits between store instances, and report-only Sheets writes with literal text.
- Targeted browser suites: 27 passed. Includes cloud-import review/confirmation at 320/497/1440 px; unchanged device records; invalid import refusal; reconciliation/card accounting; Settings backup scrolling; all-screen layouts at 320/390/768/1024/1440/1920 px; financial entry/edit/persistence; readable forms and errors at up to 200% text size.
- Production build passed. Final type check performed after the record-order preservation change; focused Firestore tests passed again.
- Dependency audit: zero known vulnerabilities after compatible overrides for grpc-js and the gaxios uuid dependency.
- Live read-only checks: Firebase credential matched the project, Firestore read succeeded, and the private spreadsheet was accessible with its single existing Sheet1 tab. An initial check's forced Node shutdown caused a Windows cleanup assertion after both reads succeeded; repeating with clean Firestore shutdown passed.
- Initial security test startup timeout was increased from 15 to 45 seconds for SDK startup; the full suite then passed.

## Remaining limitations and next steps

The owner's actual Google login, real backup import, and live Sheets export still require end-to-end verification. None occurred automatically. Production HTTPS hosting is not deployed. The separate local preview uses port 3002 and an ignored private environment profile; the original port 3001 device tracker remains available. Private credentials were not committed. Keep the Admin JSON outside Git and move it out of Downloads into a private credentials folder when practical.

Cloud updates use explicit Refresh, not live listeners. Offline cloud writes are not queued. Reads currently load the full ledger; larger ledgers need pagination. Imports above 400 records require a reviewed batch migration. Sheets snapshots are manual and create new dated tabs. Direct Firebase Admin/IAM or spreadsheet edits remain outside application audit guarantees. Account snapshots and monthly budget edits retain their existing explicit last-save behavior; revision-validated records reject stale edits.
