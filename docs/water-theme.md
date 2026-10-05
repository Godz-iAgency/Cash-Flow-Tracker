# Water appearance preview

This update implements the latest water-theme request against the existing app. It preserves layout dimensions, spacing, responsive rules, navigation positions, financial classifications, cent calculations and the existing workflows. The broader entry, budget and bank-check redesign in the attached brief is outside this visual pass.

## Palette and appearance

All UI color values are in `src/water-tokens.css`. Both stylesheet layers use those tokens. Dark mode is the default. **Advanced → Appearance → Dark / Light** remembers the preference on this browser/device without changing financial records. The app name and original logo assets are unchanged.

The navy, aqua, seafoam and coral follow the supplied palette. Light mode uses the supplied background, cards, text and button; links, muted text, success and warning text use darker related shades so text remains readable. The frosted finish uses static gradients and subtle inset light rather than a large scrolling blur layer. The build generates browser/install/offline colors from the same token source.

## Motion and feedback

- The Home SVG wave uses one compositor transform over 28 seconds. It pauses when the document is hidden.
- The Add dialog turns off all decorative animation and transitions, including effects behind the dialog.
- Page fades last 180 ms, budget-water reveals 280 ms and the single successful-save ripple 280 ms. The budget water shows the amount left rather than the amount spent. No effects play sounds.
- Reduced-motion mode disables animations and transitions and omits the ripple.
- A successful save shows **Saved → Undo** for five seconds. Double submissions share one stable entry ID and are locked while saving.

Undo is the one requested behavior addition. A new save is cancelled through a retained, inactive revision and an immutable audit record; an edit is restored through another revision. Stale, repeated and expired Undo requests are rejected, as are requests after a relevant bank snapshot changes. Firestore handles the write and audit atomically. Legacy Sheets appends a `voided` column and revision without overwriting existing rows. Private endpoints retain the existing sign-in, origin and JSON checks.

## Review without live data

Append `?preview=water` to the branch deployment URL to use synthetic records. This mode makes no cloud API requests and uses a separate on-device storage key. It cannot import, alter or export real cloud financial records. Sample entries can be added and undone to review the interaction. The preview banner identifies sample data.

The update was developed and tested on a review branch, then merged into main after the user explicitly approved publishing it. No live financial data was written during development, validation or deployment.

## Validation

The production build and all 58 financial/security unit checks passed. The 81 browser scenarios were validated through the full suite and targeted reruns; the final 14 water-theme, screenshot and PWA checks all passed. The added checks cover text contrast on every page and its forms in both modes, light-mode persistence, reduced motion, background pausing, a still Add dialog, expense/income/card-transfer Undo, double submissions and scroll frame timing at phone size with fourfold CPU throttling. The contrast audit checks visible text, form values and placeholders against card-gradient endpoints, using the [WCAG text-contrast thresholds](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Screenshots of Home, Budget and Add in both modes are written to `.local/water/screenshots/`, along with phone versions. Contrast and scrolling results are in `.local/water/`. A browser performance sample is not a physical phone test; review on the intended phone remains useful.
