import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { setAccessTokenProvider } from './api';

let auth: ReturnType<typeof getAuth>;
export async function initializeCloud(config: FirebaseOptions) {
  auth ??= getAuth(initializeApp(config, 'cash-flow-client'));
  await auth.authStateReady();
  setAccessTokenProvider(async () => auth.currentUser?.getIdToken());
}
export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}
export const signOutGoogle = () => signOut(auth);
