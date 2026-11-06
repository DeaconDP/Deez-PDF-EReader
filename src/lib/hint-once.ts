/**
 * One-time hints ("Swipe to turn pages · pinch to zoom"). Seen hints are
 * remembered in a storage-like object (localStorage in the app). Every access
 * is guarded: if storage is missing or throws (private mode, blocked site
 * data), the hint simply shows again, which is the safe fallback.
 */
export type HintStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const PREFIX = 'deezpdf-hint-seen:';

export function hintStorageKey(hint: string): string {
  return `${PREFIX}${hint}`;
}

/** true unless storage says this hint was already seen. */
export function shouldShowHint(hint: string, storage: HintStorage | null | undefined): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(hintStorageKey(hint)) !== '1';
  } catch {
    return true;
  }
}

/** Remember that the hint was seen. Never throws. */
export function markHintSeen(hint: string, storage: HintStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.setItem(hintStorageKey(hint), '1');
  } catch {
    /* storage full or blocked: the hint will show again next time */
  }
}

/** The browser's localStorage, or null when even reading the property throws. */
export function browserHintStorage(): HintStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
