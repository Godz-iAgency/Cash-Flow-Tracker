# Cash Flow Tracker

A private, mobile-first cash-flow ledger built with React, TypeScript, Vite, and a small Express server. Google Sheets is the connected database. Every amount is stored and calculated in whole cents.

## Start locally

Requires Node.js 22.12+ (Node.js 24 recommended).

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

- **Dashboard:** recorded income, actual expenses, net cash flow, daily activity, planned totals, category spending, and recent entries.
- **Transactions:** daily ledger, search, date and type filters, and edits with preserved previous versions.
- **Budget:** every supplied expense item, planned versus actual, remaining amount, and monthly plan adjustments that leave other months intact.
- **Accounts:** all five supplied accounts, manual balances, monthly inflows and outflows, and Personal / Business / All filters.
- **Insights:** daily, weekly, and monthly spending; needs versus wants; average discretionary spending; purchases under $10; repeated merchants and categories; unplanned, miscellaneous, and snack spending.

Phones use bottom navigation and a persistent Add transaction button. Tablets use a compact sidebar, while laptops and desktops use wider card layouts. Forms become bottom sheets on phones. Layouts include safe-area spacing, keyboard focus management, reduced-motion support, and print styles. Money is always displayed to two decimal places.

## Source data and assumptions

The repository and local workspace were empty. The provided attachment was the **written project specification**; no source spreadsheet was attached or available for inspection. The supplied plan was transcribed exactly into `shared/seed.ts`:

| Monthly plan | Calculated amount |
| --- | ---: |
| Planned income | $2,600.00 |
| Planned expenses, 13 items | $2,569.30 |
| Planned remaining | $30.70 |

These totals are derived from records, not hard-coded UI totals. Initial recorded income and expenses are zero: planned income is not a paycheck received. All five account balances are initially **unset**, because no balances were supplied. Business budgets and business planned income are not invented.

The written plan becomes a recurring monthly template. A budget edit creates an override only for the selected month. All amounts use USD. The browser's local date/time determines entry defaults and calendar periods; weeks run Monday through today. Account balances are manually maintained snapshots, not automatically adjusted ledger balances. Credit-card balances represent amounts owed. Transfers affect account movement but never increase income, expenses, needs, or wants.

## Google Sheets setup

1. Create a Google Cloud project and enable the **Google Sheets API**.
2. Create a service account and download its JSON key. Keep that file private and outside this repository.
3. Create a **separate, empty, private spreadsheet** for this app. Share it only with the service account email as an Editor. Existing, differently structured source spreadsheets are not imported automatically.
4. Copy `.env.example` to `.env`. Set `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY` using the service account JSON. The key can contain literal `\n` line breaks.
5. Set a strong `APP_PASSWORD` and a random `SESSION_SECRET` of at least 32 characters. Generate a secret with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

6. Restart the server. The app asks for your password before reading financial data. Its first authenticated read initializes the six application tabs.

| Tab | Purpose |
| --- | --- |
| `transactions` | Stable IDs, dates, times, type, integer amount in cents, category, subcategory, merchant, description, account IDs, scope, classification, notes, timestamps, revision |
| `accounts` | Labels, last four digits only, account type, scope, optional balance snapshot and timestamp |
| `categories` | Stable IDs and category names |
| `budgets` | Stable plan IDs, category, item, amount in cents, scope, and `*` template or `YYYY-MM` override |
| `income` | Planned income records; actual income is an Income transaction |
| `audit` | Before/after snapshots of financial changes with IDs and timestamps |

Sheets are a database rather than a frontend table: the frontend never submits row numbers. Every edit appends a revision, and reads resolve the latest record by ID. A transaction change and its audit record are sent in the same atomic Sheets batch. Existing incompatible tab headers cause a descriptive error instead of an overwrite. Literal text is written as string cell values to prevent descriptions becoming spreadsheet formulas.

Do not enter full bank/card numbers, CVVs, PINs, or bank credentials. `.env` and downloaded service-account keys must never be committed. On-device entries are **not automatically migrated** when connecting Sheets; download your backup first. Source-spreadsheet migration needs the actual source and a separate reviewed mapping.

The server serializes writes within **one running server instance**. Google Sheets has no compare-and-swap operation here: do not run multiple replicas or edit application tabs directly while using the app. Transaction revisions reject stale edits. This MVP does not promise tamper-proof history if someone directly edits the spreadsheet.

## Private hosting

The production server binds to loopback. Put it behind an HTTPS reverse proxy, set `NODE_ENV=production`, and forward the request to port 3001. The proxy must preserve Host and set `X-Forwarded-Proto`; loopback proxies are trusted. Password sessions use signed, expiring, HttpOnly, SameSite cookies and Secure cookies in production. API writes require JSON and the same origin. Repeated failed sign-ins are limited.

Do not expose the Vite development server publicly. This repository has not been deployed, and no live spreadsheet credentials have been configured.

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
