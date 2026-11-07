import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReaderBackStack } from '../src/lib/android-back.ts';

function fakeHistory() {
  const calls: string[] = [];
  return { calls, pushState: () => void calls.push('push'), back: () => void calls.push('back') };
}

test('system Back while reading leaves the reader once', () => {
  const history = fakeHistory();
  let backs = 0;
  const stack = new ReaderBackStack(history, () => backs++);
  stack.enterReader();
  stack.enterReader(); // idempotent
  assert.deepEqual(history.calls, ['push']);
  stack.handlePopState();
  assert.equal(backs, 1);
  stack.leaveReader(); // library mount after the system Back: nothing left to pop
  assert.deepEqual(history.calls, ['push']);
});

test('leaving via the on-screen button pops our entry without a second Back', () => {
  const history = fakeHistory();
  let backs = 0;
  const stack = new ReaderBackStack(history, () => backs++);
  stack.enterReader();
  stack.leaveReader();
  assert.deepEqual(history.calls, ['push', 'back']);
  stack.handlePopState(); // the pop we caused
  assert.equal(backs, 0);
});

test('a pop with no reader open is ignored', () => {
  let backs = 0;
  const stack = new ReaderBackStack(fakeHistory(), () => backs++);
  stack.handlePopState();
  assert.equal(backs, 0);
});
