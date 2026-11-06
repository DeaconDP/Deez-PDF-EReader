/**
 * When a new toast may take the screen. Pure (no DOM) so it can be tested.
 *
 * A toast with an action (Undo) owns the screen until it ends: an
 * informational or error message that arrives meanwhile waits its turn, so an
 * unrelated message can't cut the Undo window short. Another action toast
 * does replace it (e.g. a second removal, which commits the first anyway).
 * Only the newest waiting message is kept.
 */

export type ToastKind = { hasAction: boolean };

export type ToastArrival = 'show' | 'replace' | 'queue';

export function toastArrival(current: ToastKind | null, incoming: ToastKind): ToastArrival {
  if (!current) return 'show';
  if (current.hasAction && !incoming.hasAction) return 'queue';
  return 'replace';
}

/** Whether a waiting message should show once the current toast leaves for `reason`. */
export function showsQueuedAfter(reason: 'timeout' | 'action' | 'replaced' | 'dismissed'): boolean {
  // When replaced, the replacing toast takes over and the waiting one keeps waiting.
  return reason !== 'replaced';
}
