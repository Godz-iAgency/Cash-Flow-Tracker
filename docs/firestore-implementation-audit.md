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

The owner confirmed successful Google login in the local preview. Real backup import and live Sheets export still require end-to-end verification; neither occurred automatically. Production HTTPS hosting is not deployed. The separate local preview uses port 3002 and an ignored private environment profile; the original port 3001 device tracker remains available. Private credentials were not committed. Keep the Admin JSON outside Git and move it out of Downloads into a private credentials folder when practical.

Cloud updates use explicit Refresh, not live listeners. Offline cloud writes are not queued. Reads currently load the full ledger; larger ledgers need pagination. Imports above 400 records require a reviewed batch migration. Sheets snapshots are manual and create new dated tabs. Direct Firebase Admin/IAM or spreadsheet edits remain outside application audit guarantees. Account snapshots and monthly budget edits retain their existing explicit last-save behavior; revision-validated records reject stale edits.

## Follow-up: clear backup selection and entry to the tracker

The complete unit/security suite was rerun after this fix: all 41 tests passed, including all seven requested accounting invariants. Whitespace checks passed.

Inspection of the reported setup screen found that an empty cloud correctly required an initial import, but **Review this device** silently substituted the starting plan when no records existed at the preview's address. Browser storage on port 3002 cannot read records from port 3001. The upload control was also a transparent file input over a label, and the final action did not clearly say it would open the app.

The existing CloudSetup component now uses an accessible button opening a hidden JSON file input, with a clear two-step choose/review flow, the selected filename, and explicit folder/file instructions. Device review is offered only for saved records in this browser; the starting plan is a separate deliberate choice. **Import & open tracker** becomes available after confirmation, waits for the import and subsequent load, and opens the Dashboard. File changes reset confirmation. Failed imports retain the reviewed records for retry. A tracker load failure after a successful import retries loading without importing again.

Files changed for this follow-up: src/CloudSetup.tsx, src/App.tsx, src/theme.css, tests/browser/cloud.spec.ts, docs/firestore-setup.md, and this report. No schema changes, new financial calculations, database writes, or new components were required. Source backups and device records were preserved.

Verification: production build and type checks passed; 11 cloud browser scenarios passed in installed Chrome. Checks cover the actual file chooser, automatic Dashboard entry after a confirmed import, unchanged device data, invalid/oversized files, reselecting the same file, reset confirmation, failed import retry, and a read-only retry after an imported tracker fails to load. Screen checks cover 320/497/1440 px, wheel scrolling in a short 450 px viewport, no horizontal overflow, and 200% text size. The 497 px review screenshot was visually inspected. The downloaded real backup was validated read-only: 5 accounts, 9 categories, 13 budget items, 1 income plan, 1 income source, no transactions, and no known opening balances. It has not been imported by these tests; cloud responses are mocked.

## Vercel hosting preparation

The local cloud preview process had stopped; it was restarted on port 3002 and its Firestore status endpoint returned HTTP 200. The supplied Vercel domain served the frontend, but /api/status returned Vercel NOT_FOUND (404). The repository previously had no serverless API entry point or hosting routing configuration. A Windows service-account file path cannot work in the hosted environment.

The Express routes were extracted into server/app.ts with a createApp factory. server/index.ts retains local startup; api/index.ts exports the hosted handler. vercel.json builds the Vite frontend and routes API requests to the handler, keeping the SPA fallback away from API paths. server/credentials.ts supports server-only FIREBASE_SERVICE_ACCOUNT_JSON with the original local-file alternative; Firestore and Sheets share its validated credential. APP_ORIGIN validates write origins against the explicit HTTPS website, independently of proxy forwarding headers. Hosted mode refuses incomplete configuration with JSON 503 rather than opening device mode. Owner identity checks and financial mutation logic are preserved.

Files: api/index.ts, vercel.json, server/app.ts, server/index.ts, server/credentials.ts, server/firebase.ts, server/sheets.ts, tests/hosting.test.ts, tsconfig.json, .env.example, README.md, docs/vercel-setup.md, docs/firestore-setup.md, and this audit. No financial calculations, record schemas, Google Sheets tabs, or financial records changed.

Validation: production build passed; final TypeScript check passed; all 47 unit/security tests passed, including the seven accounting invariants and six hosting cases. Hosting cases cover the exported API handler, fail-closed configuration, public-status secret exclusion, Google identity requirements, HTTPS and forged origin handling, malformed/wrong-project credentials, local-file compatibility, and a report export authenticated using the JSON credential. External API writes in these checks are mocked. Whitespace checks passed. Final hosted sign-in and real database/report writes remain dependent on the user's Vercel variables, Firebase authorized domain and spreadsheet Editor share. No real cloud import or report export was performed.

### Hosted runtime follow-up

The first automatic Vercel deployment completed its build but the API returned FUNCTION_INVOCATION_FAILED. A local reproduction compiling the API/server/shared modules to ESM without the development loader failed with ERR_MODULE_NOT_FOUND on the extensionless server/app import. Internal API, server and shared-module imports now specify .js paths; no financial code was changed. A new regression check compiles the complete module graph and starts the hosted API in plain Node, successfully serving its fail-closed setup response. All 48 unit/security tests and the production build passed after the path changes. Hosted API startup is checked separately after the automatic redeployment; real owner sign-in and writes still require console configuration.
