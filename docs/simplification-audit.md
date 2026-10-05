# Interface simplification

The user's request was to remove excess text, duplicate controls and features that distract from straightforward finance tracking. This pass focuses the daily experience on balances, recording money, reviewing spending and planning.

## Removed from the interface

- Daily financial lessons, axiom labels and educational reference links.
- The extra workspace card, repeated app branding, breadcrumb, sidebar budget and sidebar add button.
- The persistent row of four review/settings shortcuts on every page.
- Three overlapping home transaction shortcuts and the extra account shortcut. A single add control opens Expense, Income and Transfer in the same form.
- Repeated home income-allocation tables, financial-action summaries, spending flags, category breakdown and daily totals strip.
- The large empty wants headline and elaborate empty-pattern cards.
- Duplicate backup controls in Settings and the page footer.
- Repeated explanations of obvious calculations and verbose save messages.
- Empty upcoming-expense sections and always-expanded account equations/history.

## The resulting structure

Home shows total cash, monthly recorded income/spending/net, a compact all-account daily review, the budget and five recent transactions. Recent entries are sorted by financial date and time, with creation time breaking ties, using a copy of the records.

Five main pages remain: Home, Transactions, Budget, Accounts and Insights. More holds Notes & Reminders, Money Flow, Check-In History, Month-End Review, Settings, Storage & backup, Refresh data and installation/update controls. Mobile uses the same five destinations and a persistent add button. Desktop has one add button at the page heading.

Charts and spending flags live in Insights. Payment defaults expand under Budget. Account calculation/history expands on request; a saved discrepancy or stale-comparison warning remains visible. Unknown balances stay unknown. The daily review always uses today and all accounts, independently of the selected month/classification; it only completes through explicit confirmation. The timed reminder uses one **Review due** status instead of a second warning block.

## Preservation and checks

Financial models, integer-cent calculations, backend routes, Google sign-in, Firestore, Sheets schemas, immutable history and backup contents were not changed. No live financial records were deleted or written. Validation uses isolated local fixtures and mocked cloud import requests.

The production build and all 53 financial/security checks passed. All 70 browser scenarios passed across the full run and targeted rerun, including 320–1920-pixel layouts, 200% text, landscape forms, wheel/touch/keyboard scrolling, all secondary tools, backups containing the complete original state, financial entry/edit/persistence, unknown balances, transfers, credit-card payments, stale comparisons, cloud import review and safe PWA updates. Tests were adjusted to use More and the shorter review labels; removed duplicate controls are checked through their replacement paths.

The desktop, phone dashboard and sign-in layouts were visually reviewed. Chrome installation checks reported zero application errors. A physical phone installation remains a device-side action.
