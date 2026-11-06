import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showsQueuedAfter, toastArrival } from '../src/lib/toast-queue.ts';

const info = { hasAction: false };
const undo = { hasAction: true };

test('a toast shows at once on an empty screen', () => {
  assert.equal(toastArrival(null, info), 'show');
  assert.equal(toastArrival(null, undo), 'show');
});

test('messages without an action wait for a live Undo toast', () => {
  assert.equal(toastArrival(undo, info), 'queue');
});

test('ordinary toasts replace each other, and a new Undo replaces anything', () => {
  assert.equal(toastArrival(info, info), 'replace');
  assert.equal(toastArrival(info, undo), 'replace');
  assert.equal(toastArrival(undo, undo), 'replace');
});

test('the waiting message shows once the Undo toast really ends', () => {
  assert.equal(showsQueuedAfter('timeout'), true);
  assert.equal(showsQueuedAfter('action'), true);
  assert.equal(showsQueuedAfter('dismissed'), true);
  assert.equal(showsQueuedAfter('replaced'), false);
});
