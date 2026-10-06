# Simple daily money

The daily interface serves five jobs: see my cash, record money, review entries, plan spending and check my accounts. The logo and water palette remain. The Apple design skill guided system typography, clear hierarchy, immediate press feedback, restrained material and accessible interaction. The user's stricter water-motion rules take priority over springs or decorative gestures.

## Daily screens

- **Home:** known checking/savings cash, smaller credit-card debt, three quick actions, this month's spending and budget left, editable entries from today, and Check my bank. Missing balances open individual account setup. Income, net cash flow, review warnings, the month picker and financial-risk cards no longer crowd Home.
- **History:** entries grouped by day, newest first, search and type filter. The spending and income totals filter the list. Tap an entry to edit or remove it; removal retains its original value in the audit.
- **Plan:** planned, spent and left-to-spend values, one compact category list, and details that open in place. Items show budget, spent and left; spending opens its supporting entries. Edit name, amount, category, due day, payment account and Need/Want. Changes can apply from this month forward or only this month. Hide an item without deleting earlier plans. Pay bill uses the unpaid amount, and Paid appears only from recorded expenses.
- **My money:** cash and credit cards owed, collapsible Personal/Business groups and account rows. Tap an account for its movements, editing and bank check. Account movements include every entry affecting that account, independently of the transaction's Personal/Business classification.
- **More:** spending insights, charts, notes/reminders, money flow, check-in history, month-end review, settings, installation, appearance, refresh, storage/backup and detailed history. The daily paths do not require these tools. Spending today, this week and this month open matching entries; the week can span two months.

The same Personal/Business/All choice persists across the five screens. Home and Accounts use current balances. History and Plan retain their month picker. Both desktop and phone navigation expose the same five tabs.

## Entry and bank check

Spent opens with Amount focused. Search What for, choose Paid from, and save. Got paid and Move money use the same form; a credit-card destination says Pay card and remains a transfer. Optional store, note, date, time and classification live in More options. Quick entry under More options accepts `5 grocery heb`, `$37.74 gas` and `.05 other`; it fills a draft and never saves automatically. Keyboard order follows amount, purpose, account and Save; optional controls remain keyboard accessible. A stable entry ID and save lock prevent duplicate taps. Saved offers five seconds of Undo and Add another.

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


## Plain-language pass — 2026-10-06

The five visible tabs are Home, History, Plan, My money and More. Everyday entry actions say I spent, I got paid and Move money. Daily screens avoid accounting terms; deeper reports and earlier detailed tools remain behind Advanced inside More. The target is wording understandable without finance knowledge, rather than a numerical reading-level certification.

Plan shows the spending plan, spending so far and the amount left. If spending exceeds the plan, it says Over my plan with the positive amount over and a coral highlight. Expected income and the forecast after planned spending open under Money coming in. Home removes the repeated income number. Missing bank balances are explicit, and incomplete cash totals say Balances added so far.

The Apple skill also guided a shorter default entry form, a quiet amount field, grouped settings and compact reminder rows. Bill fields, report details and raw original history open only on request. Purchases outside the plan retain the words typed into What for; keyboard navigation no longer replaces them with Other. The change history presents readable Before/After values; original records remain available underneath. Income breakdowns follow Personal/Business selection. Dialogs keep background controls inert, restore focus on close, and expose invalid fields inside closed disclosures.

Backup & devices explains the downloaded .json file and how to use another device in everyday words. Google Sheets is labeled as a dated copy; it is still a manual reporting export. Connection errors offer a next action without exposing server output. All financial data paths and calculation rules remain intact; testing used sample records only.


### Final validation for the plain-language pass

The production build and type checks passed. All 98 browser checks passed in the final complete run, with no skips. Coverage includes the plain tab names, reports collapsed by default, free-text purchase descriptions, bank checks, duplicate saves and Undo, reminders and immutable history, report scopes, hidden-account editing, backup review/import, PWA updates, offline privacy, contrast in both themes and 320–1920 pixel layouts with enlarged text up to 200%.

Reduced motion produced zero animations, Add stayed still, and the repeating Home wave paused in the background. In the CPU-throttled simulated phone check, the 95th-percentile frame intervals were 17.0 ms without effects and 17.0 ms with the wave and ripple. This is browser simulation, not measurement on a physical phone. Home, Plan and Add screenshots in both themes are in the local review gallery.

The prior 68 unit, persistence, security and accounting checks remain the financial baseline; shared and server calculation code did not change in this plain-language pass. No live financial records were changed.
