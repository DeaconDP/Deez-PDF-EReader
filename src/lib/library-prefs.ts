/**
 * My Library's "Sort & filter" choices: the options people see, how saved
 * choices are read back, and when the control is offered at all.
 * Pure (no DOM, no storage) so it can be tested with node --test.
 */

export type LibraryFilter = 'all' | 'unread' | 'reading' | 'finished';

/** The sorts offered. Older builds offered more; those fall back to the default. */
export type LibrarySort = 'lastOpened-desc' | 'dateAdded-desc' | 'name-asc';

export type LibraryPrefs = {
  filter: LibraryFilter;
  sort: LibrarySort;
};

export const DEFAULT_LIBRARY_PREFS: Readonly<LibraryPrefs> = Object.freeze({
  filter: 'all',
  sort: 'lastOpened-desc',
});

export const SORT_OPTIONS: ReadonlyArray<{ value: LibrarySort; label: string }> = [
  { value: 'lastOpened-desc', label: 'Recently opened' },
  { value: 'dateAdded-desc', label: 'Recently added' },
  { value: 'name-asc', label: 'Title A–Z' },
];

export const FILTER_OPTIONS: ReadonlyArray<{ value: LibraryFilter; label: string }> = [
  { value: 'all', label: 'All PDFs' },
  { value: 'unread', label: 'Not started' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
];

/** "Sort & filter" shows only once the shelf holds more than this many PDFs. */
export const SORT_FILTER_MIN_BOOKS = 6;

export function isLibrarySort(value: unknown): value is LibrarySort {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export function isLibraryFilter(value: unknown): value is LibraryFilter {
  return FILTER_OPTIONS.some((option) => option.value === value);
}

/**
 * Reads saved prefs (the raw localStorage string, or null). Anything missing,
 * malformed or no longer offered (e.g. "Largest", "Name Z–A") becomes the default.
 */
export function parseLibraryPrefs(raw: string | null | undefined): LibraryPrefs {
  let saved: unknown = null;
  if (raw) {
    try {
      saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
  }
  const record = saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {};
  return {
    filter: isLibraryFilter(record.filter) ? record.filter : DEFAULT_LIBRARY_PREFS.filter,
    sort: isLibrarySort(record.sort) ? record.sort : DEFAULT_LIBRARY_PREFS.sort,
  };
}

/** Whether to offer "Sort & filter" for this many PDFs on the shelf (pending removals excluded). */
export function showsSortFilter(shelfCount: number): boolean {
  return shelfCount > SORT_FILTER_MIN_BOOKS;
}

/**
 * The prefs to actually apply. While the control is hidden, a filter or sort
 * picked earlier must not quietly hide or reorder books, so defaults apply.
 *
 * Render-only: never save the result. The saved choice must survive a dip to
 * six or fewer books (e.g. a removal still offering Undo) and come back once
 * the shelf grows again. `prefs` is never modified.
 */
export function effectiveLibraryPrefs(prefs: LibraryPrefs, shelfCount: number): LibraryPrefs {
  return showsSortFilter(shelfCount) ? prefs : { ...DEFAULT_LIBRARY_PREFS };
}

export function isDefaultLibraryPrefs(prefs: LibraryPrefs): boolean {
  return prefs.filter === DEFAULT_LIBRARY_PREFS.filter && prefs.sort === DEFAULT_LIBRARY_PREFS.sort;
}
