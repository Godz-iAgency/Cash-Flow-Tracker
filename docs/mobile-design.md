# Mobile design update

The supplied finance-app reference is applied to the existing tracker: near-black backgrounds, rounded charcoal cards, an olive/green balance panel, circular quick actions, green/gold activity lines and a gold coin brand mark. Existing screens, navigation destinations, financial records and accounting rules are preserved.

## Inspection and implementation scope

The tracker already had responsive navigation, account balances, transaction entry, daily activity, budget funding, reviews, notes, check-ins and immutable balance comparisons. Those components are extended through shared styling. Existing account totals and daily summaries supply the new presentation; no new financial model is introduced. Account ownership remains independent of transaction classification.

## Files changed

| File | Change |
| --- | --- |
| `src/theme.css` | Shared dark theme, responsive cards, touch controls, mobile navigation and sticky form actions |
| `src/main.tsx` | Loads the theme after existing layout styles |
| `src/App.tsx` | Dashboard hero, typed quick-entry drafts, coin branding and scroll-aware mobile add button |
| `src/pages.tsx` | New `BalanceHero`, using existing account balance totals |
| `src/components.tsx` | Existing activity chart displays actual daily totals as green/gold SVG lines and areas |
| `src/TransactionForm.tsx` | Optional initial transaction type for shortcuts; existing edits retain their type |
| `index.html` | Dark browser theme color |
| `public/favicon.svg` | Scalable gold coin brand mark |
| `tests/browser/design.spec.ts` | Four design and data-preservation checks |
| `README.md` | Design behavior and report link |
| `docs/mobile-design.md` | This implementation report |

## Google Sheets schema changes

None. No tabs, columns, records or migration behavior changed. The existing Sheets schema and `Balance_Reconciliations` history remain as documented in the [implementation audit](implementation-audit.md). No live spreadsheet was modified.

## New components and interactions

`BalanceHero` shows current checking/savings cash across all accounts. Credit-card balances and available credit are excluded. Unknown balances remain unknown; partial totals explicitly identify the known subtotal. It has Add entry, Income, Transfer and Accounts shortcuts. Drafts use the existing transaction form and save path.

The mobile add button is hidden while those shortcuts are visible and returns when scrolling past them. On other screens it remains available. Transaction dialogs keep their heading and save/cancel actions accessible while the fields scroll. The chart uses recorded daily amounts and accessible currency/date hover details; no sample performance percentages are added to the product.

## Calculations

No accounting calculation changed. The balance hero calls the existing cash totals helper. The activity chart uses the same daily income/expense summaries and integer-cent amounts as before. Income, cash expenses, card purchases, card payments, transfers, independent classification and reconciliation discrepancy handling retain their existing behavior. Comparisons never create balancing entries or rewrite records.

## Validation performed

- Production build and TypeScript checks passed after the final changes.
- All 36 accounting, storage and security checks passed across the unit run and a focused security retry. The first concurrent run hit a server-start timeout during the build; the isolated security retry passed.
- All 32 existing browser scenarios passed with the theme, covering accounting workflows, notes, funding, reviews, check-ins, reconciliation and layouts at 320, 390, 768, 1024, 1440 and 1920 pixels.
- Four new browser scenarios passed: balance totals and untouched stored data at 390/1440 pixels; 320-pixel layout at 125% zoom and 667x375 landscape entry; scroll-aware mobile add behavior.
- After the final mobile add-button and touch/contrast refinements, the four new scenarios and both existing phone-layout scenarios passed again (six checks).
- Visual review covered mobile and desktop dashboards and mobile transaction entry. Preview captures use isolated sample fixtures, not existing user financial records.
- Whitespace validation passed.

## Remaining limitations

Responsive checks use Chromium viewport emulation; physical iOS/Android devices and their on-screen keyboards have not been tested. Live Google Sheets credentials are not configured in this workspace, so live Sheets validation remains unavailable. The reference is translated into scalable application styling and a vector coin mark; the collage's three-dimensional artwork is not embedded.
