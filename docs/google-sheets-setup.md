# Connect Google Sheets together

The app already has a Google Sheets database integration. It uses a service account to read and append records on the server. A spreadsheet link identifies the database; a service account authorizes access to that private file. A general API key is not the credential this app uses.

## 1. Preserve current entries

In the app, choose **Settings → Export full backup** before connecting anything. The same export is available through **Storage & backup** and the page footer. Keep that downloaded backup. On-device records are not automatically transferred into Google Sheets. If you have entries to keep, we will review the backup and plan the transfer before switching storage modes. Do not clear browser data.

## 2. Make the database file

Create a new, empty spreadsheet in [Google Sheets](https://sheets.google.com/). Name it **Cash Flow Tracker Database**. Keep General access set to **Restricted**. You can send its link in this chat; do not add public access or build tabs by hand. The app initializes its required tabs after an authenticated connection.

## 3. Enable the Sheets API

Open [Google Cloud Console](https://console.cloud.google.com/). Create/select a project for this app. Go to **APIs & Services → Library**, search **Google Sheets API**, and select **Enable**. [Google's API setup reference](https://developers.google.com/workspace/sheets/api/quickstart/nodejs#enable_the_api).

## 4. Create the app's service account

Go to **IAM & Admin → Service Accounts → Create service account**. Name it **cash-flow-tracker** and complete creation. For this app's direct spreadsheet access, no project-wide administrative role or domain-wide delegation is needed. Copy the service account's email, ending in `iam.gserviceaccount.com`. [Google's service account and file-sharing guide](https://developers.google.com/workspace/guides/create-credentials#service_account_credentials).

## 5. Share the file with the service account

Open your new spreadsheet, click **Share**, enter the service account email, and choose **Editor**. Leave general access Restricted. You can deselect **Notify people** because service accounts do not receive invitation emails. [Google's direct-sharing instructions](https://developers.google.com/workspace/guides/create-credentials#access_google_workspace_files_directly_with_a_service_account).

## 6. Download credentials privately

In Cloud Console, open that service account, select **Keys → Add key → Create new key → JSON → Create**. Save the downloaded JSON outside the repository. Tell me the local file path; do not paste the private key or JSON contents into chat. [Google's key creation guide](https://docs.cloud.google.com/iam/docs/keys-create-delete).

## 7. Configure and verify together

Once you provide the spreadsheet link and local JSON path, we can configure the server's private `.env` with the spreadsheet ID, service account email and private key, plus an app password and session secret. None of those secrets belongs in the frontend or Git.

We will restart the app, sign in, verify that it shows **Google Sheets**, inspect its initialized tables and verify stored records. Any existing on-device history needs the reviewed transfer described above. We will not add fake transactions to your financial ledger for testing or silently alter balances.

For access from real phones/tablets outside this computer, all devices also need the same privately hosted HTTPS app. Connecting Sheets establishes shared storage; it does not itself publish the application.
