# Simple daily money

The daily interface serves five jobs: see my cash, record money, review entries, plan spending and check my accounts. The logo and water palette remain. The Apple design skill guided system typography, clear hierarchy, immediate press feedback, restrained material and accessible interaction. The user's stricter water-motion rules take priority over springs or decorative gestures.

## Daily screens

- **Home:** known checking/savings cash, smaller credit-card debt, three quick actions, this month's spending and budget left, editable entries from today, and Check my bank. Missing balances open individual account setup. Income, net cash flow, review warnings, the month picker and financial-risk cards no longer crowd Home.
- **Activity:** entries grouped by day, newest first, search and type filter. The spending and income totals filter the list. Tap an entry to edit or remove it; removal retains its original value in the audit.
- **Budget:** three headline values, one compact category list, and details that open in place. Items show budget, spent and left; spending opens its supporting entries. Edit name, amount, category, due day, payment account and Need/Want. Changes can apply from this month forward or only this month. Hide an item without deleting earlier plans. Pay bill uses the unpaid amount, and Paid appears only from recorded expenses.
- **Accounts:** cash and credit cards owed, collapsible Personal/Business groups and account rows. Tap an account for its movements, editing and bank check. Account movements include every entry affecting that account, independently of the transaction's Personal/Business classification.
- **Advanced:** spending insights, charts, notes/reminders, money flow, check-in history, month-end review, settings, installation, appearance, refresh, storage/backup and detailed history. The daily paths do not require these tools. Spending today, this week and this month open matching entries; the week can span two months.

The same Personal/Business/All choice persists across the five screens. Home and Accounts use current balances. Activity and Budget retain their month picker. Both desktop and phone navigation expose the same five tabs.

## Entry and bank check

Spent opens with Amount focused. Search What for, choose Paid from, and save. Got paid and Move money use the same form; a credit-card destination says Pay card and remains a transfer. Optional store, note, date, time and classification live in More options. Local quick entry accepts `5 grocery heb`, `$37.74 gas` and `.05 other`; it fills a draft and never saves automatically. Keyboard order follows amount, purpose, account and Save; optional controls remain keyboard accessible. A stable entry ID and save lock prevent duplicate taps. Saved offers five seconds of Undo and Add another.

Check my bank works one account at a time. Matching balances advance to the next account. A difference opens entries since the previous check and offers Add missing entry or an explicit Bank is right, fix balance action. A correction retains both the original mismatch and corrected match as immutable evidence. Today completes when all visible accounts in the scope match, and another movement requires a new check. The server validates bank observations using the device's time-zone offset.

## Data preservation

All amounts remain integer cents. Income, expenses, transfers and card payments retain their existing accounting behavior. Firestore remains authoritative and changes plus audit evidence commit atomically. New budget versions use effective month keys; earlier months and original names remain available, and renamed items still match older spending. New optional account and budget metadata is validated in backups. Sheets headers extend append-only; legacy rows remain readable. Automatic-payment changes for a versioned budget start in the selected month rather than replacing earlier defaults.

The supplied 2026-10-04 backup and the initial seed contain the same 13 budget amounts, totaling $2,569.30, and $2,600.00 planned personal income. No missing or incorrect initial bill amount was found in that comparison. An independent original spreadsheet was not supplied for this check. Google Sheets remains a manual snapshot/report export; this change does not claim automatic two-way synchronization.

No live financial records were changed while implementing or testing this release. Preview mode uses synthetic records in a separate browser-storage key and makes no cloud requests. The review branch is `codex/simple-daily-money`; publication to main requires the user's review, as specified in the original brief.

## Visual and motion checks

The palette lives in `src/water-tokens.css`. The light-mode secondary text token is slightly darker to maintain contrast on hovered, expanded rows. Rows and controls reflow with enlarged system text. Frosted material is limited to navigation; reduced transparency or increased contrast removes it. Budget/account details use native, accessible disclosures. Press feedback is immediate.

Only Home's wave repeats, once per 28 seconds, and it pauses in the background. Tab fades last 180 milliseconds; the save ripple plays once. Add has no decorative animation. Reduced motion disables animations and ripples. There are no sounds.

Phone performance checks use a simulated 390-pixel viewport and CPU throttling, not physical-phone measurements. Installing and reviewing the PWA on the user's actual phone remains a device-side check.

## Release validation — 2026-10-05

- Production build and type checks passed.
- All 68 unit, persistence, security and accounting checks passed.
- All 89 browser checks passed, with no skipped tests. Coverage includes five-tab navigation, clickable totals, collapsed details, editing hidden-account history, one-cent entry, duplicate taps, Undo, transfers/card payments, partial bills, effective-month plans, bank checks, backup import, PWA updates and offline caching.
- Dark/light contrast checks passed on daily views, entry forms and expanded editors. Layouts passed at 320–1920 pixels, including 200% system text and full tab-label containment.
- Reduced motion has zero animations; Add stays still; the Home wave pauses when backgrounded. The CPU-throttled 390-pixel scrolling check passed: the 95th-percentile frame interval was 17.0 ms without effects and 17.1 ms with the wave and ripple. This is simulated browser evidence, not a physical-phone guarantee.
- Home, Budget and Add screenshots in both modes are available in the local review gallery; all five daily pages also have desktop and phone screenshots.

Phone review: tap a spending total to open its entries, expand a Budget item and an Account, then try a small Spent entry and Undo in the sample-data preview. Review installation and scrolling on the actual phone before live publication.
