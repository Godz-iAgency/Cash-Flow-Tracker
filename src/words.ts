export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/auth\/unauthorized-domain/i.test(message)) return 'Google sign-in is not set up for this web address yet.';
  if (/auth\/popup-blocked/i.test(message)) return 'Allow pop-ups in your browser, then try Google sign-in again.';
  if (/auth\/(popup-closed-by-user|cancelled-popup-request)/i.test(message)) return 'Sign-in closed before it finished. Try again when you are ready.';
  if (/auth\/(network-request-failed|internal-error)|failed to fetch|networkerror|unexpected token|unexpected end of json|firebaseerror|firestore|function_invocation_failed/i.test(message)) return 'The app could not connect. Check your connection and try again.';
  if (/auth\/(user-disabled|invalid-credential|user-token-expired)|not authenticated|unauthorized/i.test(message)) return 'Please sign in again to continue.';
  if (/revision|fingerprint|stale/i.test(message)) return 'This record changed. Reload your records, then try again.';
  return message;
}
