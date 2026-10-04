# Scrolling update

The 497px tablet layout from the supplied screenshot scrolls with wheel and touch gestures in a fresh Chromium session. The exact reported freeze was not reproduced there. The update removes an avoidable source of persistent locks: saving and restoring an inline body overflow value when a dialog mounts/unmounts.

Page scrolling is now explicit. CSS locks the page only while a dialog backdrop exists; otherwise it enables native scrolling even if an old inline lock remains. This also handles multiple dialogs without depending on effect cleanup order. Each dialog retains its own vertical scroll area. Horizontal menus allow horizontal gestures and vertical scrolling through to the page. Touch panning and pinch zoom remain enabled. Focus management, fixed navigation, financial records and all calculations are preserved.

## Files

- `src/components.tsx`: removes imperative overflow save/restore from Modal.
- `src/theme.css`: explicit document scrolling, DOM-based dialog locks and touch scroll areas.
- `tests/browser/scroll.spec.ts`: six new wheel/touch scrolling checks.
- `README.md`: scrolling behavior and setup-guide links.
- `docs/google-sheets-setup.md`: guided configuration of the existing Sheets database integration.
- `docs/scroll-audit.md`: this report.

No new financial components, calculations, Google Sheets schema, records or migrations. No credentials are configured by this change. On-device entries still require backup and a reviewed transfer before switching to Sheets.

## Verification

The six new tests passed at 320, 390, 497, 768 and 1440px. They check wheel scrolling on Dashboard, Budget, Accounts and Insights; touch scrolling on Budget; recovery from a deliberately lingering inline body lock; independent wheel and touch scrolling inside an expanded transaction form; the locked background; restored scrolling after closing transaction/settings dialogs; horizontal review-menu scrolling; vertical wheel scrolling over that menu; and touch scrolling starting on a scope button.

Production build and TypeScript checks passed. All 45 existing workflow and typography browser scenarios passed in a separate regression run. Combined with the six new scroll checks, all 51 distinct browser scenarios passed. Whitespace validation passed. No accounting/server/schema code changed.

## Viewing the update

Reload the app to load the current files. In a desktop device frame, wheel or trackpad scrolling works when the pointer is inside the app. Mouse-drag swipe behavior is controlled by the emulator. If the frame still intercepts scrolling after a reload, compare the same app URL in a normal browser tab. Browser gesture checks are not physical Android/iOS device testing; the exact user's emulator/device condition remains unverified.
