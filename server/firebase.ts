import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const firestoreEnabled = () => process.env.STORAGE_BACKEND === 'firestore';
export function firebaseWebConfig() {
  return { apiKey: process.env.FIREBASE_API_KEY, authDomain: process.env.FIREBASE_AUTH_DOMAIN, projectId: process.env.FIREBASE_PROJECT_ID, appId: process.env.FIREBASE_APP_ID };
}
export function validateFirebaseConfiguration() {
  if (!firestoreEnabled()) return;
  if (Object.values(firebaseWebConfig()).some(v => !v) || !process.env.FIREBASE_SERVICE_ACCOUNT_PATH || !process.env.FIREBASE_OWNER_EMAIL) throw new Error('Firestore requires the web configuration, private service-account file path, and owner email.');
  adminApp();
}
function adminApp() {
  const existing = getApps().find(app => app.name === 'cash-flow-server');
  if (existing) return existing;
  let credential;
  try { credential = JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!, 'utf8')); }
  catch { throw new Error('The private Firebase credential file could not be read.'); }
  if (credential.project_id !== process.env.FIREBASE_PROJECT_ID) throw new Error('The Firebase credential belongs to a different project.');
  return initializeApp({ credential: cert(credential), projectId: credential.project_id }, 'cash-flow-server');
}
export function requireOwner(token: Pick<DecodedIdToken, 'email' | 'email_verified' | 'uid' | 'firebase'>, email = process.env.FIREBASE_OWNER_EMAIL) {
  if (!email || token.email?.toLowerCase() !== email.toLowerCase() || !token.email_verified || token.firebase.sign_in_provider !== 'google.com' || !token.uid) throw new Error('This tracker is private. Sign in with the owner’s Google account.');
  return token.uid;
}
export async function authenticateFirebase(authorization?: string) {
  if (!authorization?.startsWith('Bearer ') || authorization.length > 10000) throw new Error('Please sign in with Google.');
  const token = await getAuth(adminApp()).verifyIdToken(authorization.slice(7), true);
  return requireOwner(token);
}
export const firebaseDatabase = () => getFirestore(adminApp());
