import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTapGesture } from '../src/lib/tap-gesture.ts';

test('a short, still, single-finger touch is a tap', () => {
  assert.equal(isTapGesture({ maxDistance: 3, durationMs: 120, maxPointers: 1 }), true);
});

test('swipes, pinches, long presses and cancelled gestures are not taps', () => {
  assert.equal(isTapGesture({ maxDistance: 60, durationMs: 150, maxPointers: 1 }), false);
  assert.equal(isTapGesture({ maxDistance: 2, durationMs: 150, maxPointers: 2 }), false);
  assert.equal(isTapGesture({ maxDistance: 2, durationMs: 900, maxPointers: 1 }), false);
  assert.equal(isTapGesture({ maxDistance: 0, durationMs: 100, maxPointers: 1, cancelled: true }), false);
  assert.equal(isTapGesture({ maxDistance: Number.NaN, durationMs: 100, maxPointers: 1 }), false);
});
