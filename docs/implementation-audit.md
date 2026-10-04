# Cash Flow Tracker implementation audit

Inspection and extension of the existing application, October 3, 2026. The project was extended in place. Existing financial records, planned income, the original 13-item personal budget, five account labels, transaction types, classification rules and append-only audit model remain intact.

## Inspection before implementation

| Requested behavior | Existing implementation | Decision |
| --- | --- | --- |
| Responsive dashboard, ledger, budget, accounts and insights | React components and layouts already cover phone, tablet, laptop and desktop | Preserve; check new account controls at the existing six viewport widths |
| Income, cash expense, card purchase and card payment | Transaction validator, accountFlows and currentBalance already implement the required directions; card payments are transfers | Preserve; add separate invariant tests for each case |
| Internal transfers | One source/destination record; excluded from reported income, expenses and net | Preserve; verify equal opposite cash movements |
| Personal / Business independence | Explicit transaction scope separate from account scope | Preserve; verify personal expense from business account and business income into personal checking |
| Dated opening balances and projections | Account snapshot fields and currentBalance include later dated movements, ignore future movements, and avoid counting old entries twice | Extract a shared breakdown from this calculation |
| Planned expense funding and income sources | Expense_Funding and Income_Sources already provide defaults without rewriting transactions | Preserve |
| Actions, reminders, financial axioms and leak reviews | Existing action, awareness and leak components and tables | Preserve |
| Daily completion, history, reminder settings and month reviews | Existing review components, Settings, Daily_Checkins and Month_Reviews | Preserve |
| Compare calculated with actual balance | A manual snapshot reset exists, but no separate actual observation, captured discrepancy or comparison history | Add only this missing workflow |

Reused AccountsView, accountFlows, currentBalance, Modal, shared validators, browser storage migration, generic extension saves, protected API routes, audit history and the Sheets append mechanism. No application restart or redesign was required.

## Existing Google Sheets tabs and columns

This inventory comes from the existing adapter schema. Live Sheets credentials are not configured in this workspace; the running app reports configured=false. The private spreadsheet's actual tab contents could not be inspected. Existing and legacy schemas were exercised through a simulated Sheets API with preserved data rows.

| Existing tab | Existing columns |
| --- | --- |
| `accounts` | `id`, `name`, `lastFour`, `scope`, `type`, `balanceCents`, `balanceUpdatedAt`, `balanceIncludedTransactionIds`, `balanceAsOf` |
| `categories` | `id`, `name` |
| `budgets` | `id`, `label`, `category`, `amountCents`, `scope`, `month` |
| `income` | `id`, `label`, `amountCents`, `scope`, `month` |
| `transactions` | `id`, `date`, `time`, `type`, `amountCents`, `category`, `subcategory`, `merchant`, `description`, `accountId`, `toAccountId`, `scope`, `classification`, `notes`, `createdAt`, `updatedAt`, `revision` |
| `audit` | `id`, `entity`, `entityId`, `at`, `before`, `after` |
| `Notes_Reminders` | `id`, `title`, `note`, `category`, `related_expense_id`, `related_account_id`, `scope`, `priority`, `status`, `reminder_date`, `amount_affected_cents`, `previous_cost_cents`, `new_cost_cents`, `monthly_savings_cents`, `annualized_savings_cents`, `created_at`, `completed_at`, `updated_at`, `revision` |
| `Daily_Checkins` | `id`, `date`, `scope`, `confirmed_at`, `transaction_fingerprint`, `revision`, `completed`, `completed_at`, `transactions_reviewed` |
| `Leak_Reviews` | `id`, `month`, `dismissed_at` |
| `Expense_Funding` | `id`, `budget_id`, `month`, `payment_account_id`, `amount_cents`, `due_day`, `autopay`, `updated_at`, `revision` |
| `Income_Sources` | `id`, `name`, `scope`, `category`, `default_account_id`, `updated_at`, `revision` |
| `Settings` | `id`, `reminder_time`, `small_purchase_threshold_cents`, `updated_at`, `revision` |
| `Month_Reviews` | `id`, `month`, `scope`, `note`, `next_month`, `created_at`, `updated_at`, `revision` |

## Required schema change

Add one tab: **Balance_Reconciliations**, with these 16 columns in order:

`id`, `account_id`, `account_type`, `as_of`, `actual_balance_cents`, `opening_balance_cents`, `opening_as_of`, `money_in_cents`, `money_out_cents`, `calculated_balance_cents`, `difference_cents`, `ledger_fingerprint`, `note`, `created_at`, `updated_at`, `revision`

All monetary columns store integer cents. opening_balance_cents, calculated_balance_cents and difference_cents can be blank/unknown. account_type preserves the historical calculation's cash or liability convention. ledger_fingerprint captures relevant financial inputs to detect later changes, including direct spreadsheet edits without revision increments. Each comparison has its own immutable ID; another comparison appends another row. An audit row is appended atomically with each comparison.

No additional columns are required in the existing tabs. Previous compatibility logic still accepts the exact known older accounts and Daily_Checkins header prefixes and adds only their already-supported rightmost headers. Existing financial data rows are never rewritten by initialization. A conflicting header stops initialization with an explanation rather than overwriting data. Browser storage gains only an empty balanceReconciliations collection when absent; the existing storage key and all financial collections are preserved. Switching browser storage to Sheets remains an explicit separate setup; no financial-data import or replacement was performed.

## New components and calculations

ReconciliationPanel extends each existing account card with the opening snapshot, applicable account movements, the current calculated balance, latest saved comparison and expandable history. ReconciliationForm previews a comparison at the bank observation's date and time. BalanceEquation and SavedComparison render the same calculation and preserved evidence.

- Cash/debit: calculated = opening snapshot + subsequent money in - subsequent money out.
- Credit-card debt: calculated owed = opening owed + subsequent charges/money out - subsequent payments/money in. A negative amount owed represents an account credit.
- Difference = actual bank balance - calculated balance, at the same observation time. Zero is a match; nonzero explicitly requires review. An unknown opening leaves calculation and difference unknown.
- An old comparison whose relevant financial inputs changed shows **Ledger changed; compare again**. Its original actual, calculated, discrepancy and opening values remain unchanged.
- Account movement calculations include all transaction classifications and are independent of the selected report month. Existing monthly movement figures remain separately visible.

Saving a comparison does not adjust an account, create a transaction, complete a check-in or change reports. The existing deliberate transaction edit and **Update balance** actions remain available with audit trails; Update balance explicitly resets the opening snapshot and flags previous comparisons when it changes their financial inputs.

## Accounting invariants and verification

| Invariant | Verification |
| --- | --- |
| Income | Destination balance rises by the exact cents received; reported income rises |
| Cash expense | Cash balance falls; reported expense rises, including a ten-cent purchase |
| Card purchase | Amount owed and reported expense rise; cash stays unchanged |
| Card payment | Cash and amount owed fall; original expense is counted only once |
| Transfer | Sender falls and receiver rises equally; income, expenses and net stay unchanged |
| Personal / Business | Account ownership never overrides explicit transaction classification |
| Reconciliation | Opening and later flows equal calculated balance; actual differences are flagged; all financial records remain unchanged |

- Production build and TypeScript checks: passed.
- Accounting, validation, legacy migration, Sheets storage and security tests: **36 passed**.
- Browser scenarios: **32 distinct scenarios passed** across the full sweep and focused reruns. Tests cover widths **320, 390, 768, 1024, 1440 and 1920 pixels**. Older assertions were scoped to the current-balance element because the comparison now repeats that value; the mobile workflow uses the visible connection/help button. The affected scenarios passed their final reruns.
- Phone and desktop comparison screenshots were visually reviewed. The mobile form scrolls within the existing modal while preserving access to its controls.
- Whitespace/diff validation: passed.

Additional checks cover matching/unknown/negative actual balances, immutable comparison history, stale financial input detection, irrelevant and future transactions, invalid money/dates, stale saves, large serialized audit records, legacy browser data, Sheets column order, unknown and numeric cents round-trips, literal notes rather than formulas, atomic comparison/audit appends, authenticated endpoints and rejected cross-origin writes. Browser scenarios exercise reload persistence, zero opening information, discrepancy review and the complete card purchase/payment workflow. Existing daily reviews, budget overrides, notes, funding, income-source drafts, and cross-tab data preservation remain covered.

## Files changed

- [shared/allocation.ts](../shared/allocation.ts)
- [shared/reconciliation.ts](../shared/reconciliation.ts)
- [shared/model.ts](../shared/model.ts)
- [shared/actions.ts](../shared/actions.ts)
- [shared/seed.ts](../shared/seed.ts)
- [src/Reconciliation.tsx](../src/Reconciliation.tsx)
- [src/pages.tsx](../src/pages.tsx)
- [src/App.tsx](../src/App.tsx)
- [src/styles.css](../src/styles.css)
- [server/index.ts](../server/index.ts)
- [server/sheets.ts](../server/sheets.ts)
- [tests/reconciliation.test.ts](../tests/reconciliation.test.ts)
- [tests/sheets-extension.test.ts](../tests/sheets-extension.test.ts)
- [tests/security.test.ts](../tests/security.test.ts)
- [tests/browser/reconciliation.spec.ts](../tests/browser/reconciliation.spec.ts)
- [tests/browser/allocation.spec.ts](../tests/browser/allocation.spec.ts)
- [tests/browser/app.spec.ts](../tests/browser/app.spec.ts)
- [README.md](../README.md)
- [docs/implementation-audit.md](implementation-audit.md)

## Remaining limitations

- Live Google Sheets access and bank balances were unavailable. Schema migration and storage writes were verified with a simulated API, not a private live spreadsheet. The new tab is created on the next configured Sheets initialization.
- Actual bank balances are entered manually; the app has no bank connection. Calculations depend on a correct opening snapshot and complete later entries.
- A dated opening bank snapshot already includes earlier movements, including entries logged late. Reconciliation before that snapshot is unavailable. The unchanged legacy rule includes recorded transactions within the snapshot minute and treats newly recorded entries in that minute as subsequent movements.
- Financial times have minute precision and use local calendar timestamps. Client and server should use a consistent financial timezone, particularly for legacy snapshots inferred from update time.
- Fingerprints and the entire serialized comparison/audit record are each limited to 45,000 characters for Sheets cell compatibility. A very large movement history needs a deliberately reviewed new opening snapshot before another saved comparison.
- Google Sheets writes are serialized in one server instance; multiple independent app servers are not supported for concurrent writes. Browser and Sheets modes remain separate storage choices.
- Existing reminder delivery remains inside the open app; operating-system push notifications are not configured.
