# Clear-water design

The current design follows the Apple design skill and the user's latest brief: one appearance, real crystal-water photographs, simple lists, direct actions, and readable words. It replaces the former navy/coral palette and optional Dark / Light switch. Earlier themes remain in Git history.

## Everyday pages

Home gives the known bank balance and quick actions to spend, receive or move money. Income lists saved income sources and fills a payment draft with their receiving account. Expenses lists only the existing items for the selected Personal / Business scope, with Edit and monthly Paid controls. Cash flow shows the account/card, amount and destination for each recorded movement; every movement opens for editing. Banks & cards opens for balances, account edits and bank checks.

Advanced groups the ledger, income statement and cash-flow statement on one page. The income statement uses received minus spent and excludes transfers. The bank cash-flow statement includes both ends of transfers and excludes credit-card purchases until money actually leaves a bank. These are summaries of recorded entries, not formal tax statements or verified bank feeds. Older detailed tools, monthly plans, reminders, immutable history, backups and installation remain available on demand.

## Monthly Paid

Paid is derived from actual recorded payments for the expense item and selected month. An unchecked box opens a draft for the amount left. Saving creates one expense and its audit record; cancelling changes nothing. Partial payments remain unchecked and show the amount left. A checked box opens its payments for review or correction rather than silently deleting money records. Each month is separate, and historical plan names still match earlier payments.

The list contains all 13 supplied personal items and no invented business items. Existing amounts and plan versions stay intact. Financial storage, authentication, integer-cent calculations, bank snapshots and atomic audit writes are unchanged.

## Photography and materials

Selected large and small cards use two compressed photographs generated with the built-in image tool. See [assets and final prompts](clear-water-assets.md). Static image delivery totals about 390 KiB. Lists, inputs and entry forms use plain surfaces for speed and clarity.

One palette lives in `src/water-tokens.css`. Water-card text has a 96% pale backplate, tested against both black and white pixels behind it. Increased contrast and reduced transparency make the plate opaque. The original logo remains intact. Every daily page, optional editor and enlarged-text layout receives contrast and overflow checks.

## Motion and entry

Water photos remain still. Page changes fade once for 180 ms; a successful save can play one 280 ms ripple and offers five seconds of Undo. Reduced motion removes both. Add disables decorative activity before painting and focuses Amount. Progress bars stay still, including collapsed reports behind a dialog. No sounds play.

## Review safely

Use `?preview=simple` on the branch deployment for synthetic records. Preview uses a separate browser-storage key and makes no cloud requests. Normal sign-in continues to use the existing Firestore configuration. Google Sheets remains a manual dated reporting export, not automatic two-way syncing.

Validation uses desktop Chrome, phone/tablet viewport simulation and enlarged text. A simulated-phone frame-timing check is useful evidence, not a physical-device performance guarantee. The branch is pushed for Vercel preview review; publishing main follows the original review requirement.
