import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LIBRARY_PREFS,
  SORT_OPTIONS,
  effectiveLibraryPrefs,
  isDefaultLibraryPrefs,
  parseLibraryPrefs,
  showsSortFilter,
} from '../src/lib/library-prefs.ts';

test('offers at most four sorts', () => {
  assert.ok(SORT_OPTIONS.length <= 4);
  assert.equal(SORT_OPTIONS[0].value, DEFAULT_LIBRARY_PREFS.sort);
});

test('keeps saved prefs that are still offered', () => {
  assert.deepEqual(parseLibraryPrefs('{"filter":"reading","sort":"name-asc"}'), { filter: 'reading', sort: 'name-asc' });
});

test('migrates removed sorts to the default and keeps the filter', () => {
  for (const removed of ['size-desc', 'size-asc', 'name-desc', 'dateAdded-asc']) {
    assert.deepEqual(parseLibraryPrefs(JSON.stringify({ filter: 'finished', sort: removed })), {
      filter: 'finished',
      sort: 'lastOpened-desc',
    });
  }
});

test('falls back to defaults for missing or broken prefs', () => {
  assert.deepEqual(parseLibraryPrefs(null), DEFAULT_LIBRARY_PREFS);
  assert.deepEqual(parseLibraryPrefs('not json'), DEFAULT_LIBRARY_PREFS);
  assert.deepEqual(parseLibraryPrefs('null'), DEFAULT_LIBRARY_PREFS);
  assert.deepEqual(parseLibraryPrefs('{"filter":"bogus"}'), DEFAULT_LIBRARY_PREFS);
});

test('shows Sort & filter only above six books', () => {
  assert.equal(showsSortFilter(0), false);
  assert.equal(showsSortFilter(6), false);
  assert.equal(showsSortFilter(7), true);
});

test('a hidden control cannot hide books', () => {
  const picked = { filter: 'finished', sort: 'name-asc' } as const;
  assert.deepEqual(effectiveLibraryPrefs(picked, 6), DEFAULT_LIBRARY_PREFS);
  assert.deepEqual(effectiveLibraryPrefs(picked, 7), picked);
  assert.equal(isDefaultLibraryPrefs(effectiveLibraryPrefs(picked, 3)), true);
});

test('dipping to six books applies defaults without losing the saved choice', () => {
  const saved = Object.freeze({ filter: 'reading', sort: 'name-asc' } as const);
  const raw = JSON.stringify(saved);
  // Removing the seventh book: defaults while the control is hidden...
  assert.deepEqual(effectiveLibraryPrefs(parseLibraryPrefs(raw), 6), DEFAULT_LIBRARY_PREFS);
  assert.deepEqual(saved, { filter: 'reading', sort: 'name-asc' });
  // ...and Undo (or adding a book) brings the saved choice straight back.
  assert.deepEqual(effectiveLibraryPrefs(parseLibraryPrefs(raw), 7), saved);
  // The defaults handed out are a fresh object, not the shared frozen one.
  assert.notEqual(effectiveLibraryPrefs(saved, 0), DEFAULT_LIBRARY_PREFS);
});
