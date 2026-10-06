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


## Income, expenses and clear water — 2026-10-06

This release supersedes the earlier tab names and two-mode palette. The five main pages are Home, Income, Expenses, Cash flow and Advanced. Personal, Business and All stay available. Home keeps three primary money figures. Income offers editable sources and Add pay, with the receiving account filled from that source. Expenses is the original expense list, with Edit and a monthly Paid control. Cash flow shows the actual source and destination for each movement and has Move money plus collapsed Banks & cards. The ledger, income statement, per-bank cash flow statement and earlier tools open on Advanced.

Checking Paid opens the remaining payment amount; only saving an expense changes the status. Partial payments remain unpaid with an amount left. Opening a checked bill reviews its actual payments instead of deleting them. Selecting another month separates its payments and explicitly dates a new payment to that month. Paying a personal bill with a business bank keeps it personal. Cross-scope transfers appear on both affected banks in the cash statement; transfers and card payments do not become extra spending in the income statement. The 13 original personal bill amounts and original income plans remain intact; no business bills were invented.

There is one appearance. Two newly generated, compressed clear-water photographs sit behind pale text backplates on Home, Income, Expenses and Cash flow. The original logo stays. Final assets and exact image-generation prompts are documented in `docs/clear-water-assets.md`. Photography is static, with no repeated wave or animation. Page fades and a single save ripple stay brief; Add stays still and reduced motion disables effects. The small-phone navigation and floating Add button reflow with enlarged text. Rapid taps on Save cannot reopen an entry through the closing form.

No live financial records were changed. Browser tests use synthetic records; preview mode makes no cloud requests. Firestore and the existing dated Google Sheets export keep their existing behavior. This remains the `codex/simple-daily-money` review branch and a Vercel preview, consistent with the original instruction to ask before merging to main or changing real data.


### Clear-water release validation

- Production build and type checks passed on the final sources.
- 68 unit, persistence, security and financial checks passed, with no skips.
- The complete browser suite passed all 102 checks with no skips. After the final Paid-label polish, all 22 focused expense/payment, contrast, enlarged-text, readability and screenshot checks passed on the rebuilt app.
- Viewport coverage runs from 320 to 1920 pixels, including 200% text. All five mobile navigation buttons fit within the viewport, the floating Add button clears the navigation, and water-card text passes contrast over worst-case bright and dark image pixels.
- Reduced motion has no animations; Add has no decorative motion. In the 4x CPU-throttled 390-pixel phone simulation, the 95th-percentile scrolling interval was 17.0 ms both at baseline and with the one-shot ripple, with no stalled frames. This is simulated browser evidence, not a measurement on a physical phone.
- Home, Income, Expenses, Cash flow, Advanced and Add were captured at 320, 390, 768 and 1440 pixels. The final phone/desktop gallery is `.local/clear-water/gallery.html`; the phone contact sheet is `.local/clear-water/gallery.png`. Home, Income, Expenses and Cash flow were also inspected at 320 pixels with 200% text.

Review the sample-data preview by adding a payment from Income, opening Paid beside a bill and saving or cancelling, moving money between two accounts, and expanding Banks & cards or the Advanced ledger. Check installation and scrolling on the actual phone before live publication.


## Dark theme and preview accuracy — 2026-10-06

The latest user request replaces the light appearance with one dark appearance. Crystal-water photos remain, with a 96% dark text backplate and an opaque fallback for increased contrast or reduced transparency.

The previous design preview used invented transactions and balances. These were separate from the signed-in tracker, but its notice appeared only in Advanced and was insufficiently clear. The application no longer imports these examples. Test-only fixtures now live in `tests/browser/reviewFixture.ts`, outside the client bundle. Preview starts with only the supplied plan/account list, no received income, no purchase entries and null bank balances. Every page has an explicit Preview only notice and a link to the real tracker. A separate versioned preview-storage key leaves both older preview data and actual on-device data intact. Preview downloads use the cash-flow-preview prefix and identify preview records.

Normal signed-in mode still reads the saved server state; it does not seed example transactions. The storage notice says Saved online only after that read succeeds, or Saved on this device for local mode. A mocked authenticated Firestore-response test verifies that only returned records appear, even when device storage holds old test examples. The preview test verifies no API requests, no invented entries/balances, original expense labels, independent typed preview entries, persistent labels on every page and a distinct download filename.

The production status endpoint returned HTTP 200 with configured=true, backend=firestore, projectId=cash-flow-tracker-59ac6 and sheetsExportEnabled=true. The normal live page presented Google sign-in in the available browser. This verifies deployed configuration and authentication UI, not private authenticated financial reads; no real financial records were read or changed.

The production build and type checks passed. The complete 104-case browser run passed 100 cases; four tests needed their old sample-balance assumptions updated. The final targeted seven-case run passed the corrected empty-balance editor and bank-check cases. All 104 unique cases are covered on the final application sources, with no remaining failures. Dark contrast, 320–1920 pixel layouts, 200% text, receipt entry, transfers, duplicate saves/Undo, preview accuracy, mocked online loading, backups, PWA privacy, reduced motion and still Add are covered. The previous 68 financial/security unit checks remain the baseline; shared calculation and persistence code did not change.

In the simulated 390-pixel phone check with 4x CPU throttling, both baseline and one-shot ripple scrolling had a 17.0 ms 95th-percentile interval. About 0.14% of frames exceeded 50 ms in both runs, within the limits. This is simulation, not a physical-device guarantee. The dark screenshot gallery is `.local/clear-water/gallery.html`.


## Editable balances and wider dark-water release — 2026-10-06

The user explicitly requested publication to the existing production Vercel site through GitHub. This authorizes promoting the reviewed simplification branch to main. No private financial records were edited, imported or removed during development or release checks.

- Added a direct, accessible pencil beside each account balance. Edit balance prefills the tracked amount, saves a dated correction through the existing bank-check API, preserves prior entries and history, then closes without selecting another bank. Account names and last four digits remain editable through Edit account.
- Home’s cash total opens Cash flow with Banks & cards visible. Account rows and groups still collapse. Kept the five everyday tabs and all deeper tools in Advanced.
- Generated a third compressed, static clear-water photograph. Added imagery to everyday section headings, account-group and Advanced accents, and the sign-in background. Retained one dark appearance and readable text backplates. The generated asset and exact prompt are documented in clear-water-assets.md.
- Browser QA found and fixed a rapid second tap falling through the closed balance editor. Entry and balance forms now share the same narrow repeated-click guard; single taps remain immediate.
- Production build/typecheck passed. All 68 financial/server tests passed. The full 109-case browser run passed 105 cases; four new tests initially stopped on an incomplete fixture. After completing the fixture and asserting the existing two-record correction history correctly, the targeted checks exposed the phone tap issue. The final fixed build passed 20 repeated checks (two runs each of the five balance/layout cases, the purchase/edit/Undo flow, bank-check flow, and three save-ripple/Undo cases). All 109 unique cases have passing coverage; the full suite was not rerun after the narrow click-guard fix.
- Screenshots reviewed for Home, Income, Expenses, Cash flow, Advanced and Add at 320, 390, 768 and 1440 pixels. Layout/contrast checks also cover 1920 pixels, doubled text and increased contrast. Reduced motion disables effects; Add has no decorative animation.
- Phone-sized 4× CPU-throttled scrolling: baseline p95 17.2 ms, effects p95 17.1 ms. This is browser emulation, not a physical-phone benchmark.

Release target: `https://cash-flow-tracker-godz-i.vercel.app/`. Check the production build, photograph, installation worker and public Firestore configuration after the push. Private authenticated Firestore writes are intentionally not exercised by deployment checks.


## Current imagination window — 2026-10-06

The user explicitly requested fictional amounts in one isolated sandbox, named Current, accessible from Advanced. The five main pages remain unchanged. Current receives only a fresh snapshot of account display labels (name, last four digits, type and scope), capped at the first five visible accounts. It does not receive the financial State, account IDs, real balances, storage, API client or save callbacks. All imagined money is static integer-cent constants in its own component. Local filters and disclosures reset on close. No fictional data enters the normal preview, real tracker, backups, Firestore or Sheets.

The supplied five account types produce $2,359,971.17 imagined bank cash, including a $1,247,890.36 savings account, and $100,000 monthly income split into $60,000 Personal and $40,000 Business. Two credit cards have different imagined spending room, clearly separated from bank cash. Current reuses the three compressed crystal-water photographs, with high-contrast dark backplates, collapsible income/account details and a clear Sandbox / Never saved label. It has no decorative animations. The modal traps focus, makes background controls inert, and restores the launch button on close.

Validation: the production build and type checks passed. The 13 focused browser checks passed: six Current isolation/layout checks, two preview/online accuracy checks and five balance-edit regressions. Mocked signed-in Firestore verifies no extra API requests while opening, filtering or closing Current, zero writes, unchanged local storage, and the same actual financial totals afterward. Preview isolation verifies no API requests and unchanged preview records. Layout coverage includes 320, 390, 768 and 1440 pixels plus 200% text at 320 pixels. Contrast passes, filters retain full unclipped labels, there is no horizontal overflow, and reduced motion has zero animations. Phone, tablet and desktop screenshots are retained in .local/current. No private live records were changed. Financial/server calculation code remains unchanged.
