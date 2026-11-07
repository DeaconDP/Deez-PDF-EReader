import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hintStorageKey, markHintSeen, shouldShowHint, type HintStorage } from '../src/lib/hint-once.ts';

function memoryStorage(): HintStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

test('shows the first time, not after it was marked seen', () => {
  const storage = memoryStorage();
  assert.equal(shouldShowHint('swipe', storage), true);
  markHintSeen('swipe', storage);
  assert.equal(shouldShowHint('swipe', storage), false);
  assert.equal(storage.data.get(hintStorageKey('swipe')), '1');
});

test('hints are tracked independently', () => {
  const storage = memoryStorage();
  markHintSeen('swipe', storage);
  assert.equal(shouldShowHint('text-mode', storage), true);
});

test('throwing storage falls back to showing the hint and never throws', () => {
  const throwing: HintStorage = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(shouldShowHint('swipe', throwing), true);
  assert.doesNotThrow(() => markHintSeen('swipe', throwing));
  assert.equal(shouldShowHint('swipe', throwing), true);
});

test('missing storage still works', () => {
  assert.equal(shouldShowHint('swipe', null), true);
  assert.equal(shouldShowHint('swipe', undefined), true);
  assert.doesNotThrow(() => markHintSeen('swipe', null));
  assert.equal(shouldShowHint('swipe', null), true);
});
