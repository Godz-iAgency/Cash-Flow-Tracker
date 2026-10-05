import { AsyncLocalStorage } from 'node:async_hooks';
import * as sheets from './sheets.js';
import { firestoreEnabled, firebaseDatabase } from './firebase.js';
import { FirestoreStore, type RecordWrite } from './firestore.js';

const context = new AsyncLocalStorage<FirestoreStore>();
export const backend = () => firestoreEnabled() ? 'firestore' : sheets.configured() ? 'sheets' : 'local';
export const configured = () => backend() !== 'local';
export const withCloudUser = <T>(uid: string, operation: () => T) => context.run(new FirestoreStore(firebaseDatabase(), uid), operation);
export function cloudStore() {
  const store = context.getStore();
  if (!store) throw new Error('An authenticated cloud user is required.');
  return store;
}
export const readState = () => firestoreEnabled() ? cloudStore().readState() : sheets.readState();
export const mutate = <T>(operation: () => Promise<T>) => firestoreEnabled() ? cloudStore().mutate(operation) : sheets.mutate(operation);
export const writeRecords = (writes: RecordWrite[]) => firestoreEnabled() ? cloudStore().writeRecords(writes) : sheets.writeRecords(writes);
