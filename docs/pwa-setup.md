# Cash Flow app installation and logo

The hosted Cash Flow Tracker now has its own lime-and-gold money-flow emblem, home-screen icons, an installation manifest and a service worker. The same brand mark appears on the sign-in, setup, loading, sidebar and dashboard screens.

## Add it to a phone

Open <https://cash-flow-tracker-godz-i.vercel.app/> in the phone's browser.

- **Android, Chrome:** tap **Install app** in the tracker, or use Chrome's three-dot menu → **Install and create shortcut** → **Install** and confirm. Older versions may show **Install app** or **Add to home screen**.
- **iPhone or iPad, Safari:** use **Share** → **Add to Home Screen** → **Add**. If an **Open as Web App** switch is shown, leave it on.
- **Desktop, Chrome or Edge:** use the browser's install icon in the address bar. The tracker's **Install app** control also provides installation help when the browser has no direct install prompt.

Launch **Cash Flow** from the home screen and sign in with the same authorized Google account. Firestore loads the shared tracker across devices. An internet connection is required to load and save records. Installation does not require new Vercel environment variables or a running local server.

An installed window opens without ordinary browser tabs. Installation and Google sign-in may need to be performed separately on each device. Physical phone installation still needs to be completed on the user's device.

Official installation references: [Google Chrome](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en), [Apple Safari](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios).

## Data and updates

The service worker caches only the public manifest, icons and offline connection page. It bypasses financial API requests, writes, authorization headers and other origins. Financial responses, authentication tokens and application state are never put in its caches. Opening the app without a connection shows a reconnect page; this version does not queue financial writes offline.

A new version waits until **More → Update app** is selected. Merely discovering an update does not reload an open transaction form. A draft can be finished or cancelled before opening More. Installation help appears within More, or on the sign-in page. No financial model, amount calculation, Firestore schema, Google Sheets export or existing cloud record was changed for installation.

`npm run build` generates `dist/sw.js` with a version derived from the current built app and public assets. Vercel serves the worker without a reusable HTTP cache. Development mode does not register a service worker.

## Logo assets

Created with the built-in `image_gen.imagegen` image generation tool, then resized with high-quality browser canvas sampling.

| File | Use |
| --- | --- |
| `public/brand/cash-flow-logo.png` | Original 1254 × 1254 logo |
| `public/icons/icon-512.png` | Large installation icon, including Android maskable icon |
| `public/icons/icon-192.png` | Installation icon and in-app brand mark |
| `public/icons/apple-touch-icon.png` | 180 × 180 Apple home-screen icon |
| `public/icons/favicon.png` | 96 × 96 browser icon |

The opaque dark forest background fills the square. The central lime-and-gold emblem fits within the circular mask safe area. Rounded corners are applied by the app or operating system, rather than baked into the source image.

### Final generation prompt

> Use case: logo-brand. Create a single premium, distinctive app icon/logo for an existing private personal finance app called Cash Flow Tracker. Output a perfectly square flat full-bleed deep near-black forest green background (#090c08), with no rounded outside corners and no mockup. One bold abstract emblem centered, combining two flowing rounded interlocking directional ribbons, suggesting an elegant C/F monogram and controlled money flow. Main ribbon bright soft lime (#b9ec70), secondary small ribbon warm understated gold (#e6c46e). Precise geometric construction, confident balanced curves, generous negative space, refined premium fintech identity. Logo must read crisply at 32 px and look beautifully crafted at 512px; broad strokes, no tiny details. Keep the entire meaningful emblem inside the central 62% of the square to remain safe under circular Android icon masks. Very subtle dimensional polish is okay but predominantly clean vector-like graphic, high contrast, no dramatic glow, no texture. No text, letters written as type, words, tagline, coin dollar symbols, watermarks, border, device mockup, surrounding presentation or extra marks. Just one finished square app logo on the full-bleed dark forest canvas.

## Verification

- Production build and TypeScript validation passed.
- All 53 unit and security checks passed, including the four new service-worker checks.
- Nine browser checks passed: six responsive widths from 320 to 1920 pixels, manifest/icon validity, offline reconnect, iPhone installation help and an update discovered during an unsaved transaction draft.
- A separate normal Chrome profile reported zero installation errors. The isolated Playwright contexts prohibit installation because they are incognito; their application-related checks also passed.
- Desktop, phone dashboard and 320-pixel sign-in screens were visually reviewed using isolated local fixtures. No live financial records were written during validation.
