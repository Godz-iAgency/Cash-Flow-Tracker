# Scope selector layout correction

The Personal and Business labels wrapped inside narrow desktop buttons after the readable font-size increase. The shared scope selector now sizes buttons to fit whole labels and allows the control group to reflow. The existing full-width mobile layout is preserved. Text remains at 16px by default, with touch targets at least 44px high.

Changed application file: src/theme.css. No components, calculations, financial records, Firestore collections or Google Sheets schemas were changed.

Verification used isolated browser data and the production build. Full labels remained on one line inside their buttons without clipping; scope switching worked and saved financial data remained unchanged. Dashboard, Transactions, Budget, Accounts and Insights were inspected at 320, 390, 497, 768, 1024, 1440 and 1920 pixels, plus 320px/200%, 768px/125% and 1024px/200% font-size profiles: 50 page/layout checks passed. Production build, TypeScript and whitespace checks passed. Phone and desktop screenshots were visually reviewed. Physical devices were not tested.

The existing financial backup is cash-flow-backup-2026-10-04.json in the user's Downloads folder. A new backup can be exported from Settings → Storage & backup → Export full backup or the Export backup button at the bottom of the app. It contains the tracker state, including accounts, plans, transactions and audit history. It is separate from the private Firebase Admin credential. The original backup was not changed during this layout correction.
