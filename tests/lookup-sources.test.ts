import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEB_SEARCH_ENABLED, enabledSources, usableSourceFilter } from '../src/lib/lookup/sources.ts';

test('web search is switched off for now', () => {
  assert.equal(WEB_SEARCH_ENABLED, false);
  assert.deepEqual(enabledSources(), ['archive', 'gutenberg']);
});

test('a remembered "web" filter cannot stick while web search is off', () => {
  assert.equal(usableSourceFilter('web', false), 'all');
  assert.equal(usableSourceFilter('archive', false), 'archive');
  assert.equal(usableSourceFilter('all', false), 'all');
});

test('flipping the flag brings the Web source back', () => {
  assert.deepEqual(enabledSources(true), ['archive', 'gutenberg', 'web']);
  assert.equal(usableSourceFilter('web', true), 'web');
});
