# Firestore and Google Sheets

Firestore is the main database. Google Sheets receives explicitly requested, dated reporting snapshots. Device storage and legacy Sheets storage remain supported. No records move automatically when a connection is configured.

## What is already prepared

The Cash Flow Tracker Firebase project, web app, default Firestore database in production mode, Google sign-in provider, and private reporting spreadsheet have been created. The Sheets API is enabled. The spreadsheet must be shared as Editor with the server service account; Restricted general access can stay enabled.

## Server configuration

For the Vercel deployment, use the [Vercel setup guide](vercel-setup.md). Vercel uses FIREBASE_SERVICE_ACCOUNT_JSON instead of a local Windows file path, and APP_ORIGIN for the production HTTPS address. The following file-path instructions are for a local server.

1. Keep the exported JSON backup. Keep the private Firebase Admin JSON outside this repository; move it out of Downloads into a private credentials folder when practical. Do not upload it to the website or GitHub.
2. Set `STORAGE_BACKEND=firestore` in the server's private environment.
3. Set `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, and `FIREBASE_APP_ID` from the registered web app. This web configuration is public; it is not an Admin credential.
4. Set `FIREBASE_SERVICE_ACCOUNT_PATH` to the absolute private JSON path and `FIREBASE_OWNER_EMAIL` to your Google sign-in email. The server refuses a credential from another project.
5. Set `GOOGLE_SHEET_ID` to the report spreadsheet ID. The same server credential signs Sheets requests; no private key belongs in browser code.
6. Build and restart the server. Open its website and choose **Continue with Google**. Only a verified Google login matching the owner email can access its API.

Firebase authorized domains must include the website's hostname. Use HTTPS for hosted access. The checked-in `firestore.rules` denies all browser reads/writes; leave the production deny-all rules in place. The Admin server accesses Firestore through IAM and enforces the owner restriction itself.

## Reviewed import

Google sign-in opens the tracker immediately when its cloud records already exist. For an empty cloud tracker, the one-time setup has two steps:

1. Choose **Choose JSON backup**, open Downloads, and select the exported `cash-flow-backup-*.json` file itself. Select a file, not a folder or Firebase Admin credential. **Review this device** appears only when this browser has saved tracker records at this address. The starting plan is a separate explicit choice under **Starting without an existing backup?**; it is never substituted for missing device records.
2. Check the displayed filename, record counts and known opening balances. Keep the original backup (or download a safety copy), check **I have kept a backup and reviewed these records**, then select **Import & open tracker**. Successful import opens the Dashboard. Errors retain the reviewed backup for retry; a failure loading the tracker after import retries the read without importing again.

Browser storage is specific to an address and port. The cloud preview at `http://localhost:3002` cannot read device records saved at `http://localhost:3001`. Export a backup from the original tracker and choose that JSON file in the preview. Import preserves original amounts, classifications, timestamps and audit records without changing the source file or device storage.

An existing initialized cloud tracker, or any partial records without its initialization marker, blocks the import. This release does not merge or replace existing cloud records. Imports above 400 records require a separate reviewed batch migration. Invalid financial amounts, duplicate IDs and invalid transactions are rejected before writing. An import either commits completely or leaves the cloud unchanged.

## Reporting

After importing, open **More → Storage & backup → Export to Google Sheets**. Each export creates fourteen new `CFT_<UTC timestamp>_<unique suffix>_<table>` tabs. Existing tabs are preserved. Columns keep the existing Sheets schema and use integer cents. Text remains literal, including descriptions beginning with `=`. Audit records are included. The export is an atomic Sheets batch and never changes Firestore records.

These are manual exports, not scheduled synchronization. Editing the spreadsheet does not update the tracker. Keep JSON backups as well. Dated report tabs consume spreadsheet space and can be removed or archived separately after preserving needed reports.

## Firestore schema

`cashFlowUsers/{verified Google UID}/{table}/{hashed record key}` stores the fourteen existing State tables: accounts, categories, budgets, income, transactions, audit, notesReminders, dailyCheckIns, leakReviews, expenseFunding, incomeSources, settings, monthReviews, balanceReconciliations.

Records retain their existing fields. Budgets and planned income use ID plus month as their key, preserving both defaults and monthly overrides. IDs are hashed only for document paths; original IDs remain in records. `metadata/state` contains schemaVersion, revision, initialization timestamp, import counts/hash, preserved record ordering, and the latest mutation timestamp. Audit documents are created once and cannot be overwritten by application writes.

Each financial mutation uses a Firestore transaction and reads/updates the metadata revision. Concurrent server instances retry against the current snapshot; stale transaction/action/settings revisions are rejected by the existing validators. Account snapshot and monthly budget changes retain their existing explicit last-save behavior. Records and their before/after audit evidence commit together.

## Current limits

Hosting, the real backup import and a real Sheets export must be verified separately; unit/browser mocks do not prove cloud credentials or access. The owner confirmed successful Google sign-in in the local preview. Cloud mode requires connectivity, uses explicit Refresh for changes from another device, and reads the complete ledger on refresh/save. Large ledgers need pagination/incremental loading. Firebase client initialization can require browser persistence; Google popup sign-in can be blocked by browser settings. No bank connection, background notifications, automated reconciliation, or automatic balance corrections are added.

References: [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).
