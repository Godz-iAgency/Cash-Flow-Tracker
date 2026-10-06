import { initialState } from './seed';

// Only the supplied plan and account list. No invented purchases, pay or balances.
export function waterPreviewState() { return initialState(); }
