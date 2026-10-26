// Only a marker is retained across reloads; names and answers are not stored here.
const key = (pollId: string) => `anonpulse:test-pending:${pollId}`
export function hasPendingTest(pollId: string): boolean {
  try { return sessionStorage.getItem(key(pollId)) !== null } catch { return false }
}
export function markPendingTest(pollId: string, clientRequestId: string): void {
  try { sessionStorage.setItem(key(pollId), clientRequestId) } catch { /* Browser storage may be disabled. */ }
}
export function clearPendingTest(pollId: string): void {
  try { sessionStorage.removeItem(key(pollId)) } catch { /* Browser storage may be disabled. */ }
}
