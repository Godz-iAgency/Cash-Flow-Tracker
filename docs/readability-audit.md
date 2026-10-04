# Mobile readability and copy audit

## Findings and decisions

The previous layout used 9–12px text for many mobile labels and supporting details. The supplied 370px phone screenshot also showed slogan headings, repeated introductions and a footer tagline taking space before useful information.

LinkedIn is the requested readability reference. An official current native-mobile font specification could not be verified from its public design pages, so this implementation does not claim an exact match to its iOS or Android typography. The app uses the following explicit, testable scale instead. Relative `rem` sizing follows the scalable approach described in the [W3C design system](https://design-system.w3.org/styles/typography.html).

| Text role | Default size | Behavior |
| --- | --- | --- |
| Body and primary controls | 16px / 1rem | Main actions, transaction names/amounts, inputs and selectors |
| Supporting text | At least 14px / .875rem | Dates, financial context, notes, statuses and secondary links |
| Bottom navigation labels | 12px / .75rem | Short labels with icons; accessible page names retained |
| Card headings | 18px / 1.125rem | Wrap when needed |
| Page headings | 28px / 1.75rem | Clear page names |
| Main balances | 36–52px | Existing hierarchy, with scalable minimum/maximum sizes |

All legacy pixel font-size declarations in both style sheets now use relative units. The page respects user text sizing. At large font settings, controls wrap, summary grids use fewer columns, forms become one column, and bottom navigation can scroll horizontally. Touch targets retain their existing minimum heights. Larger chart labels have additional room, and large amount inputs grow with their text.

## Copy removed or replaced

- Replaced the five slogan-style main headings with Dashboard, Transactions, Budget, Accounts and Insights.
- Removed the shared uppercase eyebrow, page introductions, footer motto and repeated privacy tagline.
- Removed motivational introductions from monthly plan, recent transactions, category, daily summary and financial action cards.
- Replaced story-style empty states with direct descriptions and a next action.
- Removed motivational subtitles from new transaction, action and help dialogs. Edit history instructions remain.
- Replaced the Insights introduction with the actual weekly wants status and its date/recorded-data context.
- Shortened the local storage notice to an explicit backup instruction and a Storage & backup action. Detailed data-loss, setup and migration information remains in help.
- Shortened mobile navigation to Home and Entries while preserving Dashboard and Transactions as accessible names.

Functional education is retained: ownership versus classification, card debt versus cash, transfers, unknown balances, snapshot timing, reconciliation discrepancies, estimated savings, in-app reminder limits, financial-leak evidence and the requested daily financial lesson. No saved user notes or descriptions were edited.

## Files changed

| Files | Changes |
| --- | --- |
| `src/styles.css`, `src/theme.css` | Font scale, relative sizes and responsive reflow |
| `src/App.tsx` | Clear headings, concise storage/help copy and shorter navigation labels |
| `src/pages.tsx` | Removes repetitive card text and clarifies empty/weekly states |
| `src/TransactionForm.tsx`, `src/financialActions.tsx` | Removes filler subtitles and action-card copy |
| `tests/browser/readability.spec.ts` | Rendered text-size and data-preservation audit across screens/forms, sign-in and connection errors |
| Existing five browser test files | Heading assertions follow the new Dashboard heading |
| `README.md`, `docs/readability-audit.md` | Documents the scale and audit |

## Data and accounting

No new financial components, calculations, Google Sheets tabs, columns or migrations. Shared accounting code, server behavior and save paths are unchanged. The audit opens and cancels drafts and compares stored state with its original sample fixture. All seven accounting requirements remain covered by the existing accounting and browser tests.

## Validation

The rendered audit covers all nine application pages and twelve form/help states at 320, 370, 390, 768 and 1440 pixels, plus 125% font sizing at 370px and 200% font sizing at 320px. Sign-in and connection-error views are checked at 320px with default and doubled fonts using mocked server responses. Inputs must meet 16px; rendered supporting text must meet 14px; navigation is the sole 12px exception. Enlarged-font checks scale those thresholds with the root size. It also checks horizontal overflow and unchanged stored state.

The full browser suite includes the existing workflows and responsive layouts through 1920px, plus the earlier zoom and landscape entry checks. Preview screenshots use isolated sample data. Physical devices, native iOS/Android text settings and software keyboards are not verified by browser emulation. Live Sheets credentials remain unconfigured; this change does not touch any live financial data.

Final results:

- Production build and TypeScript checks passed.
- All 36 accounting, storage, schema-preservation and security tests passed in one run.
- All 45 distinct browser scenarios passed across the main run and focused cross-tab verification. The main run passed 44; one cross-tab entry timed out while its tab was in the background. The test now brings the entry tab to the foreground before typing, matching normal user interaction, and passed twice. No application persistence code changed.
- All nine new readability scenarios passed. The seven application audit profiles recorded 9,086 text/control observations across 147 screen/form visits, with no undersized text under the defined scale. These are repeated observations, not 9,086 unique labels.
- Default, 125% and 200% font checks passed without page/dialog horizontal overflow. Audit drafts and navigation left saved sample financial state unchanged.
- Visual review covered the 370px dashboard, Insights and transaction entry. Financial preview amounts come from isolated sample fixtures.
- Whitespace validation passed.
