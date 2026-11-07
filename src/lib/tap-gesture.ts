/**
 * Decide whether a finished pointer gesture was a plain tap (used by the
 * reader to show/hide its controls). Swipes move too far, pinches use more
 * than one pointer, and long presses (text selection) take too long.
 */
export const TAP_SLOP_PX = 10;
export const TAP_MAX_MS = 500;

export type GestureSummary = {
  /** Largest distance the first pointer travelled from where it went down, in CSS px. */
  maxDistance: number;
  durationMs: number;
  /** Most pointers that were down at the same time. */
  maxPointers: number;
  /** The browser took the gesture over (scroll, pinch) and sent pointercancel. */
  cancelled?: boolean;
};

export function isTapGesture(g: GestureSummary, slop = TAP_SLOP_PX, maxMs = TAP_MAX_MS): boolean {
  if (g.cancelled) return false;
  if (g.maxPointers !== 1) return false;
  if (!Number.isFinite(g.maxDistance) || g.maxDistance > slop) return false;
  if (!Number.isFinite(g.durationMs) || g.durationMs < 0 || g.durationMs > maxMs) return false;
  return true;
}
