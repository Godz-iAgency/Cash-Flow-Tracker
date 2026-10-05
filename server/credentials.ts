import { readFileSync } from 'node:fs';

export const serviceAccountConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

// One credential source for both Firestore and Sheets; its contents never reach the client.
export function readFirebaseServiceAccount() {
  let credential: unknown;
  try {
    const text = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!, 'utf8');
    credential = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch { throw new Error('The private Firebase credential could not be read. Set its server JSON variable or local file path.'); }
  const data = credential as Record<string, unknown> | null;
  if (!data || Array.isArray(data) || typeof data.project_id !== 'string' || !data.project_id || typeof data.client_email !== 'string' || !data.client_email || typeof data.private_key !== 'string' || !data.private_key) {
    throw new Error('The private Firebase credential is not a valid service-account JSON object.');
  }
  if (process.env.FIREBASE_PROJECT_ID && data.project_id !== process.env.FIREBASE_PROJECT_ID) throw new Error('The Firebase credential belongs to a different project.');
  return { project_id: data.project_id, client_email: data.client_email, private_key: data.private_key };
}
