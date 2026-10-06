# Cash Flow Tracker

A private, mobile-first cash-flow ledger built with React, TypeScript, Vite, and a small Express server. Firestore is the recommended connected database; Google Sheets receives reviewed reporting snapshots, and legacy Sheets storage remains supported. Every amount is stored and calculated in whole cents.

For the hosted app at https://cash-flow-tracker-godz-i.vercel.app, follow the [Vercel setup guide](docs/vercel-setup.md) for its exact environment variables, private server credential, Firebase authorized domain and first import. Pushes to the connected main branch deploy through Vercel. No local Windows server needs to stay running for the hosted app.

## Install on your phone

The hosted tracker is installable with its own Cash Flow logo. On Android, open it in Chrome and choose **Install app**. On iPhone or iPad, open it in Safari and choose **Share → Add to Home Screen → Add**. Sign in with the same Google account; an internet connection is needed for Firestore. See [installation and logo details](docs/pwa-setup.md) for browser options, safe updates and assets.

## Start locally

Requires Node.js 24.x, matching the hosted runtime.

```sh
npm install
npm run dev
```

Open the address printed by Vite, normally http://localhost:5173. With no Google credentials, the app clearly uses **on-device storage**. Records stay in this browser, and Export backup downloads the complete ledger and audit history. Do not clear browser storage without a backup. Local mode is intended for trying the application, not permanent cross-device financial storage.

For a built version:

```sh
npm run build
npm start
```

Open http://localhost:3001. No financial credentials are bundled in the frontend.

## Screens and responsive behavior

- **Home:** Money I have, I spent / I got paid / Move money, this month's spending, today's entries and Check my bank.
- **Income:** editable job and business income sources, quick Add pay, and received payments.
- **Expenses:** your existing monthly expense list, an Edit button for each item, and Paid boxes. Checking Paid opens a payment entry; saving it records the amount and bank/card. Partial payments show the amount left. Opening a checked box reviews its payments without deleting them.
- **Cash flow:** follow each payment from a bank/card, see where income arrives, move money between accounts, and open Banks & cards for balances.
- **Advanced:** the full ledger, income and cash-flow statements, monthly plans, reports, reminders, history, settings, backup, and installation. Details open only when requested.

Personal / Business / All stays available across the app. Phones have five bottom tabs and an Add entry button; larger screens have a sidebar. Entry forms focus Amount first and put optional fields under More options. Text, controls and cards reflow with larger system text. See [the simplification and verification audit](docs/simplification-audit.md).

## Clear-water appearance

There is one dark appearance on every device. Compressed, generated crystal-water photographs sit behind selected cards, with a dark backplate for readable text. The original logo stays intact. Colors live in `src/water-tokens.css`; no light/dark preference is required. The photos stay still. Reduced motion removes the one-time page fade and save ripple, and Add has no decorative animation. See [the design and asset guide](docs/water-theme.md).

## Source data and assumptions

The repository and local workspace were empty. The provided attachment was the **written project specification**; no source spreadsheet was attached or available for inspection. The supplied plan was transcribed exactly into `shared/seed.ts`:

| Monthly plan | Calculated amount |
| --- | ---: |
| Planned income | $2,600.00 |
| Planned expenses, 13 items | $2,569.30 |
| Planned remaining | $30.70 |

These totals are derived from records, not hard-coded UI totals. Initial recorded income and expenses are zero: planned income is not a paycheck received. All five account balances are initially **unset**, because no balances were supplied. Business budgets and business planned income are not invented.

The written plan becomes a recurring monthly template. A budget edit creates either a selected-month override or an effective version from that month forward, preserving earlier plans. All amounts use USD. The browser's local date/time determines entry defaults and calendar periods; weeks run Monday through today. Account balances start from manually entered bank snapshots and apply recorded movements after their financial timestamp. Unknown balances remain unknown. Credit-card balances represent amounts owed. Transfers affect account movement but never increase income, expenses, needs, or wants.

## Firestore and Sheets

The recommended storage is **Firestore with private Google sign-in**, with Google Sheets receiving dated reporting exports. Existing on-device and legacy Sheets modes remain supported. No financial records move automatically when cloud storage is enabled.

Follow [the Firestore setup guide](docs/firestore-setup.md). It covers owner-only access, private server credentials, reviewed backup import, report exports, the schema, and current limits. Keep production Firestore rules set to deny browser access; the authenticated server performs all financial writes atomically with audit history. An import cannot overwrite an existing cloud tracker.

## Google Sheets setup

1. Create a Google Cloud project and enable the **Google Sheets API**.
2. Create a service account and download its JSON key. Keep that file private and outside this repository.
3. Create a **separate, empty, private spreadsheet** for this app. Share it only with the service account email as an Editor. Existing, differently structured source spreadsheets are not imported automatically.
4. Copy `.env.example` to `.env`. Set `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY` using the service account JSON. The key can contain literal `\n` line breaks.
5. Set a strong `APP_PASSWORD` and a random `SESSION_SECRET` of at least 32 characters. Generate a secret with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

6. Restart the server. The app asks for your password before reading financial data. Its first authenticated read initializes the original application tabs and the additional action, allocation, settings, and review tabs.

| Tab | Purpose |
| --- | --- |
| `transactions` | Stable IDs, dates, times, type, integer amount in cents, category, subcategory, merchant, description, account IDs, scope, classification, notes, timestamps, revision |
| `accounts` | Labels, last four digits only, account type, scope, optional balance snapshot and timestamp |
| `categories` | Stable IDs and category names |
| `budgets` | Stable plan IDs, category, item, amount in cents, scope, and `*` template, `YYYY-MM` override or `from:YYYY-MM` effective version, plus optional bill details |
| `income` | Planned income records; actual income is an Income transaction |
| `audit` | Before/after snapshots of financial changes with IDs and timestamps |

Sheets are a database rather than a frontend table: the frontend never submits row numbers. Every edit appends a revision, and reads resolve the latest record by ID. A transaction change and its audit record are sent in the same atomic Sheets batch. Existing incompatible tab headers cause a descriptive error instead of an overwrite. Literal text is written as string cell values to prevent descriptions becoming spreadsheet formulas.

Do not enter full bank/card numbers, CVVs, PINs, or bank credentials. `.env` and downloaded service-account keys must never be committed. On-device entries are **not automatically migrated** when connecting Sheets; download your backup first. Source-spreadsheet migration needs the actual source and a separate reviewed mapping.

The server serializes writes within **one running server instance**. Google Sheets has no compare-and-swap operation here: do not run multiple replicas or edit application tabs directly while using the app. Transaction revisions reject stale edits. This MVP does not promise tamper-proof history if someone directly edits the spreadsheet.

## Private hosting

The production server binds to loopback. Put it behind an HTTPS reverse proxy, set `NODE_ENV=production`, and forward the request to port 3001. The proxy must preserve Host and set `X-Forwarded-Proto`; loopback proxies are trusted. Password sessions use signed, expiring, HttpOnly, SameSite cookies and Secure cookies in production. API writes require JSON and the same origin. Repeated failed sign-ins are limited.

Do not expose the Vite development server publicly. For the connected Vercel deployment, use the Vercel setup guide above.

## Optional Gemini drafts

Set `GEMINI_API_KEY` and a currently available Flash model in `GEMINI_MODEL`. The default is `gemini-2.5-flash`; change it if your Google account no longer supports that model. “Describe a transaction” sends only the description and the account/category labels needed to propose a draft. It does not send account balances or the transaction history. Uncertain fields are identified for review, and required missing fields must be supplied. The draft endpoint never saves a transaction; **Confirm & save** is always a separate action.

API references: [Google Sheets batch updates](https://developers.google.com/workspace/sheets/api/guides/batchupdate) and [Gemini content generation](https://ai.google.dev/api/generate-content).

## Verification

```sh
npm test
npm run build
npm run test:browser
```

Browser tests use Chromium by default. Install it once with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROME_PATH` to an installed Chrome/Edge executable. Browser checks cover all five screens at 320, 390, 768, 1024, 1440, and 1920 pixel widths; transaction entry/editing; transfers; persistence; budgets; accounts; and form layout. Unit tests check exact supplied totals, cents, date validation, scope separation, transfers, monthly overrides, and revision conflicts. Live Google Sheets and Gemini calls require your credentials and are not verified by these local checks.

## Financial actions and daily awareness

The new features extend the existing app and storage. Original records remain readable and calculations still use integer cents. Optional plan and account metadata extends the schemas without erasing earlier records.

**Notes & Reminders**, inside More, holds financial observations and next steps: title, note, category, optional related planned/recorded expense and account, Personal/Business scope, priority, status, reminder date, potentially affected amount, cost/savings fields, and timestamps. Search and status/priority filters include completed history. Completion does not delete a record, and edits retain prior versions in the audit trail.

Previous and new costs are **comparable monthly amounts**. When both are supplied, monthly savings are calculated as previous cost minus new cost; otherwise a monthly savings figure can be entered directly. Annualized savings are monthly savings multiplied by 12, assuming the change lasts a year. Unknown fields remain unset, a cancelled cost can be zero, and a cost increase remains negative savings. Savings summaries use completed actions only and are labeled reported figures; they are not proof of realized savings and never change income or expenses in the ledger.

The daily financial lesson was removed from the interface to keep everyday tracking focused on the user's money and actions.

**Today's review** covers every account and classification together. The home card uses today even when a different month is selected and shows spending and transaction count. Only **Confirm entries** completes the date. **Review Today** opens the dated ledger. Additions and edits invalidate the effective status while prior confirmations remain in history and audit.

**Potential financial leaks** are deterministic review signals, not findings of billing errors:

- A recurring merchant/service's monthly total at least 20% and $5 above its average across all three previous months.
- Different amounts for the same merchant/service in one month.
- Repeated equal subscription charges in one month, presented for billing-date/service review.
- Five or more want purchases below the configured small-purchase threshold in one month.
- A recurring service appearing in the current month and at least two previous months without a matching planned item.
- A category's monthly total at least 30% and $10 above its average across all three previous months.

Only recorded expenses are compared. Merchant matching ignores case and extra spaces; service groups include category, subcategory, and Personal/Business scope. Monthly averages are rounded to cents. Missing history does not imply zero spending, transfers are excluded, and incomplete records can limit the signals. “Review Bill” shows the source entries, “Create Reminder” opens an editable action draft, and “Dismiss” saves the decision. Changed underlying entries can produce a new review without deleting the old decision. Alerts never create or change a financial transaction.

### Additive Google Sheets tabs

On the next authenticated read after a server restart, the app creates only the missing extension tabs in the existing spreadsheet:

| Tab | New data |
| --- | --- |
| `Notes_Reminders` | Stable ID, title, note, category, linked expense/account IDs, scope, priority, status, reminder date, amount/cost/savings in cents, created/completed/updated timestamps, revision |
| `Daily_Checkins` | ID per date and money space, date, scope, confirmation timestamp, exact recorded transaction ID/revision snapshot, revision |
| `Leak_Reviews` | Stable review/evidence ID, month, dismissal timestamp |

New tab columns use snake_case. Money column names explicitly end in `_cents`; the original tab names and existing columns retain their meaning. The Accounts and Daily_Checkins tabs receive compatible columns appended to the right, without changing historical rows. New records follow the same append-only and atomic audit-write approach. Browser data saved before this extension gains empty collections without replacing existing financial records. Full backups include the new records as well as the original history.

Reminders are shown **inside the app** when you open it. This version does not schedule system notifications, email, or background delivery. Restart the server after updating the source so the new endpoints and tab initialization are active.


## Account allocation and reviews

A transaction’s `scope` is its explicit Personal / Business classification. It is independent of its payment or destination account’s ownership. New entries must supply it; historical classifications are preserved, and corrections use the ordinary edit and audit flow. Income requires a source, destination, and category. Expenses require a merchant, payment account, category, and Need / Want. Internal transfers are single records with different source/destination accounts, and never become income or spending. A credit-card payment is a transfer, so the purchase and its later payment are not counted as two expenses.

**Expense Funding** under Budget assigns each planned expense an expected amount, payment account, recurring due day, and autopay setting. Unassigned accounts remain **UNASSIGNED**. A recurring default can be overridden for one month; days beyond a month’s length fall on its last day. Setting funding does not change the budget or record payment. Selecting a funded budget item fills the transaction’s payment-account draft, while classification remains independently editable.

**Accounts** shows the provided operating/reserve/card roles, ownership, current balance, monthly money in/out and net movement, and upcoming assigned expenses. A bank snapshot records an explicit local **Balance as of** timestamp and the stable IDs already recorded in that minute. Movements dated before the snapshot are already included, so logging a missed older purchase does not deduct it twice. Later movements adjust the balance, and edits to those movements recompute the adjustment once. Future-dated movements wait until their date/time. Existing snapshots use their original update timestamp and creation timestamps for compatibility. Dates/times have minute precision; recorded entries in the snapshot minute are included, while newly added entries in that minute are treated as later movements. Update the snapshot to reconcile with the bank. Cash-account balance increases with inflows; a credit-card balance owed decreases with inflows and increases with purchases. Credit balances and credit limits are not cash. Partial totals identify unknown balances and show a known subtotal. The balances depend on complete recorded entries; this is not a bank connection.

**Money Flow** visually shows each recorded source/account, transfer between accounts, and expense/payee. It does not pretend to trace a particular incoming dollar through pooled funds. Saved income sources provide editable defaults for new drafts; editing a source does not rewrite historical income.

**Check-In History** shows a full calendar for any selected month, including missing days and upcoming days. Historical dates can be reviewed and explicitly completed. The history records completion time, transaction count, and the exact transaction IDs/revisions reviewed. Global daily status uses the `All` check-in; legacy per-classification confirmations remain stored. A changed transaction requires another confirmation. Consecutive days can continue through yesterday while today is pending. Completed days include today if confirmed; missed counts exclude today and future days. Calendar dates without confirmations remain visible, including dates before the first recorded entry.

**Tracker settings**, inside More, sets a local reminder time (default 18:00) and a small-purchase threshold (default $10). An incomplete day's review status changes to **Review due** after that time. The state rechecks while the app is open and on focus. It does not send desktop or mobile notifications. Real push delivery would additionally require explicit notification permission, saved push subscriptions, and a server scheduler with a configured timezone to check completion and send Web Push. Installing the app does not add push delivery or background reminder scheduling.

**Month-End Review** separates Personal / Business income and expenses, net cash flow, Need / Want, planned versus unplanned recorded spending, small purchases, transfers, largest categories, frequent merchants, active leak flags, and reported savings from actions completed in that month. Planned spending matches the budget category and subcategory within the same classification. Savings are a reported monthly change and annualized estimate, not realized cash receipts. Review notes target the following month and appear there; edits preserve an audit trail.

Additional Sheets tables:

| Tab | Stored records |
| --- | --- |
| `Income_Sources` | Stable ID, source name, classification, category, optional default destination, revision |
| `Expense_Funding` | Stable ID, budget ID, month/default, optional payment account, expected cents, due day, autopay, revision |
| `Settings` | Stable `app` ID, reminder time, small-purchase threshold in cents, revision |
| `Month_Reviews` | Stable month/classification ID, note, following month, timestamps, revision |

`accounts` adds `balanceIncludedTransactionIds` and `balanceAsOf`. `Daily_Checkins` adds `completed`, `completed_at`, and `transactions_reviewed`, retaining its original columns and `confirmed_at` for compatibility. The initializer accepts only the exact known legacy header prefixes, adds the missing rightmost headers, and leaves existing data rows intact. Prior check-in rows decode as explicit confirmations using their original timestamp and fingerprint count. All new saves append versioned records and an audit record in the same Sheets request. Connected saves refresh the latest state so balance projections include other recently recorded movements. No spreadsheet row number is used as an identifier.

## Balance reconciliation

Each account now offers **Compare actual balance**. Enter the bank's balance and the date/time it represents, review the calculation, and save an observation. Cash accounts use opening balance + later money in - later money out. Credit-card debt uses opening owed + charges/money out - payments/money in. All amounts use integer cents and account movements include all transaction classifications.

Actual minus calculated is the discrepancy. Zero means the balances match; a nonzero amount explicitly requires review. An unknown opening balance leaves calculated and difference amounts unknown. Saving an observation does not change the opening snapshot, create a balancing transaction, or rewrite any financial record. Corrections use the existing deliberate transaction-edit or opening-snapshot actions and their audit histories.

Observations retain their captured calculation, actual balance, review note and financial input fingerprint. Changes to relevant recorded movements or the opening snapshot flag an old comparison for another review without changing its saved values. Comparison history remains available inside each account. The separate **Update balance** action explicitly resets the opening snapshot, so use comparison when checking a discrepancy.

The only additional table is `Balance_Reconciliations`, with immutable observation rows and an audit record appended in the same request. Existing headers, records and calculations remain compatible; legacy browser storage gains only an empty collection. See [the implementation audit](docs/implementation-audit.md) for the full schema, existing feature inventory, changed files, test results and limitations.

## Mobile design

The tracker uses the water palette, quiet surfaces, compact rows and rounded controls. The dashboard shows current checking/savings cash and quick entry for expenses, income and transfers; credit-card balances stay separate and unknown balances remain explicitly unknown. Touch controls, scrollable filters, bottom navigation and sticky transaction actions support small screens. The floating add button returns when scrolling past the dashboard shortcuts.

Financial records, calculations and the Google Sheets schema are unchanged. See the [mobile design report](docs/mobile-design.md) for the changed files, validation and remaining device-testing limitations.

## Mobile text and copy audit

Body text and primary controls use 16px at default settings, supporting details use at least 14px, and the compact bottom-navigation labels use 12px with icons. Sizes use relative units and layouts reflow for enlarged text. Page names and empty states are direct; repeated slogans and introductions are removed. Financial explanations and storage warnings remain. See the [readability audit](docs/readability-audit.md) for the full scale, copy decisions, tests and limitations.

## Scrolling and guided Sheets setup

Pages support native wheel, trackpad and touch scrolling. Dialogs keep the close button visible above a scrollable content region with wheel, touch and keyboard support. The page lock follows the dialog's presence and disappears when it closes. **More → Backup & devices** includes **Download backup**, reporting exports and audit history. Enlarged-text bottom navigation can scroll horizontally. Reload the app after updating to load the current files. In desktop device emulators, use the wheel/trackpad inside the page; mouse dragging depends on the emulator's gesture controls.

See the [guided Google Sheets setup](docs/google-sheets-setup.md) to connect the existing database integration. Export a backup first: on-device entries do not automatically migrate when Sheets is enabled. Keep downloaded service account credentials outside the repository and provide their local path instead of pasting secret contents.


Design preview (`?preview=simple`) is separate from signed-in storage. A notice on every preview page links to the normal live tracker. Preview starts with the supplied expense/account list and no invented purchases, received income or opening balances. Test fixtures stay in test files. Normal signed-in mode loads the saved server records and identifies online storage; on-device mode identifies device storage.
