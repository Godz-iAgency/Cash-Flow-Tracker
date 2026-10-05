# Vercel setup — Cash Flow Tracker

Production website: https://cash-flow-tracker-godz-i.vercel.app/

The repository builds the Vite frontend into dist and sends /api requests to api/index.js, which uses the existing Express routes, owner verification and Firestore transactions. Local startup remains server/index.ts. Git pushes to the connected production branch trigger deployment; verify that Vercel's production branch is main.

The hosted handler is generated from server/handler.ts by scripts/build-server.mjs. It bundles the internal server/shared module graph into ready-to-run Node 24 JavaScript while keeping installed packages external. The generated API file is checked in and rebuilt by npm run build and before npm test, so Vercel does not need to resolve internal TypeScript imports at runtime. No environment values are embedded during the build.

## 1. Project settings

Open the Cash Flow Tracker project in Vercel. Under Settings → Build and Deployment, use the Vite preset, root directory at the repository root, Node.js 24.x, build command npm run build, and output directory dist. These build settings are also declared in vercel.json. No persistent server start command is needed on Vercel.

## 2. Environment variables

Open Settings → Environment Variables. Add the following to **Production**. Use these exact names, without a VITE_ prefix. The API reads them at runtime.

| Name | Value |
| --- | --- |
| STORAGE_BACKEND | firestore |
| APP_ORIGIN | https://cash-flow-tracker-godz-i.vercel.app |
| FIREBASE_PROJECT_ID | cash-flow-tracker-59ac6 |
| FIREBASE_API_KEY | Copy apiKey from the Firebase web app config already provided |
| FIREBASE_AUTH_DOMAIN | cash-flow-tracker-59ac6.firebaseapp.com |
| FIREBASE_APP_ID | 1:721811348525:web:945d54785b1e2a3b88aca4 |
| FIREBASE_OWNER_EMAIL | christopher@godz-iagency.com |
| FIREBASE_SERVICE_ACCOUNT_JSON | The complete contents of the downloaded Cash Flow Tracker Firebase Admin service-account JSON; mark Sensitive |
| GOOGLE_SHEET_ID | 1wgvnpdNsTERFfUele75AWWEHWcKKUpBN3EcNVMtknhk |

For FIREBASE_SERVICE_ACCOUNT_JSON, open the downloaded file whose name starts with cash-flow-tracker-59ac6-firebase-adminsdk, copy its whole JSON object, and paste it directly into Vercel's value field. Do not add extra quotes or convert it into JavaScript. This is the Admin credential, not the cash-flow backup. Keep it out of chat, Git and frontend variables. The server uses the same credential for Firestore and Sheets; its project must match FIREBASE_PROJECT_ID.

Leave FIREBASE_SERVICE_ACCOUNT_PATH unset on Vercel: a Windows Downloads path cannot exist there. APP_PASSWORD, SESSION_SECRET, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are not required for this Firestore profile. GEMINI_API_KEY is optional and should remain unset while resolving the separate AI-key issue. No financial records are migrated by setting these variables.

Preview deployments are separate from Production. If you want cloud-enabled previews, give them a deliberate configuration and exact HTTPS APP_ORIGIN matching the preview's fixed domain, and authorize that hostname in Firebase. This setup does not enable all temporary preview addresses automatically. Missing cloud settings return a setup error rather than silently switching to device storage.

## 3. Firebase authorized domain

In the Cash Flow Tracker Firebase project, open Authentication → Settings → Authorized domains → Add domain. Enter:

cash-flow-tracker-godz-i.vercel.app

Use the hostname only, without https:// or a slash. Keep FIREBASE_AUTH_DOMAIN as cash-flow-tracker-59ac6.firebaseapp.com. Google sign-in must remain enabled. Firestore production deny-all client rules remain valid because the authenticated server performs database operations through Admin IAM.

## 4. Spreadsheet access

Keep the report spreadsheet Restricted. Share it as Editor with firebase-adminsdk-fbsvc@cash-flow-tracker-59ac6.iam.gserviceaccount.com. Google Sheets API must be enabled in the Cash Flow Tracker project. The user previously enabled the API; live read access was verified. Writes still need an Editor share and a deliberate snapshot export.

## 5. Redeploy and verify

After saving the environment variables, open Deployments and redeploy the latest main commit. Environment changes affect new deployments. Open /api/status on the production site: it should return JSON with backend firestore, configured true, and authenticated false before sign-in. A 404 means the API adapter is not deployed. A 503 setup error means the server configuration needs correction. This endpoint never exposes the Admin JSON or private key.

Then open the website and sign in using christopher@godz-iagency.com. If Firestore already has records for that Google user, the Dashboard opens. Otherwise choose cash-flow-backup-2026-10-04.json, review the records, confirm, and select Import & open tracker. Browser records from localhost do not appear automatically at the hosted domain. The backup is the portable copy; a completed import is shared through Firestore across local and hosted logins to the same Firebase user.

Finally use Settings → Storage & connection → Export snapshot to Google Sheets. A snapshot adds fourteen new dated report tabs; existing tabs and Firestore records are preserved. Scheduled synchronization is not enabled.

## Local preview

The private local cloud profile remains at localhost:3002. Its ignored .local/cloud.env uses the local Admin file path. A stopped local process causes connection refused; restarting it does not change records. The hosted website can be used without leaving this PC's local server running.

## Validation and limits

The server/shared modules use explicit .js import paths so compiled TypeScript can start in Node ESM. Regression checks compile the full API module graph and separately serve the actual packaged JavaScript API in plain Node without tsx, preventing development-only module resolution from concealing startup failures. The final build and all 49 unit/security tests passed.

No live import or export was performed as part of hosting preparation. Server checks cover missing hosted configuration, JSON and local-file credentials, wrong-project and malformed credentials, public-status secret exclusion, owner-auth requirements, and HTTPS-origin validation through a proxy. Final production login and database/report writes depend on the environment variables, authorized domain and sharing being configured in their consoles.

Official references: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Vercel environment variables](https://vercel.com/docs/environment-variables), [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).
