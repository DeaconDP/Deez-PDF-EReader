import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPendingRemovals, UNDO_WINDOW_MS, type TimerFns } from '../src/lib/pending-removal.ts';

/** Manual clock: timers only fire when `tick` passes them. */
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const fns: TimerFns = {
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (handle) => void timers.delete(handle as number),
  };
  return {
    fns,
    get active() {
      return timers.size;
    },
    tick(ms: number) {
      now += ms;
      for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
      }
    },
  };
}

const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

function setup(commitImpl?: (id: string) => Promise<void>) {
  const clock = fakeTimers();
  const committed: string[] = [];
  const errors: string[] = [];
  let changes = 0;
  const removals = createPendingRemovals({
    commit: commitImpl ?? (async (id) => void committed.push(id)),
    timers: clock.fns,
    onChange: () => void changes++,
    onCommitError: (id) => void errors.push(id),
  });
  return { clock, committed, errors, removals, get changes() { return changes; } };
}

const books = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('hides the item immediately without deleting it', () => {
  const s = setup();
  s.removals.remove('b');
  assert.equal(s.removals.isHidden('b'), true);
  assert.deepEqual(s.removals.visible(books).map((x) => x.id), ['a', 'c']);
  assert.deepEqual(s.committed, []);
  assert.equal(s.changes, 1);
});

test('commits after the Undo window and stays hidden until then', async () => {
  const s = setup();
  s.removals.remove('a');
  s.clock.tick(UNDO_WINDOW_MS - 1);
  await flushMicrotasks();
  assert.deepEqual(s.committed, []);
  s.clock.tick(1);
  await flushMicrotasks();
  assert.deepEqual(s.committed, ['a']);
  assert.equal(s.removals.isHidden('a'), false); // gone from storage, no longer tracked
});

test('undo cancels the delete and restores the item', async () => {
  const s = setup();
  s.removals.remove('a');
  assert.equal(s.removals.undo('a'), true);
  assert.equal(s.removals.isHidden('a'), false);
  assert.deepEqual(s.removals.visible(books).map((x) => x.id), ['a', 'b', 'c']);
  s.clock.tick(UNDO_WINDOW_MS * 2);
  await flushMicrotasks();
  assert.deepEqual(s.committed, []);
  assert.equal(s.clock.active, 0);
  assert.equal(s.removals.undo('a'), false);
});

test('a second removal commits the first right away', async () => {
  const s = setup();
  s.removals.remove('a');
  s.removals.remove('b');
  await flushMicrotasks();
  assert.deepEqual(s.committed, ['a']);
  assert.equal(s.removals.isHidden('b'), true);
  assert.equal(s.removals.undo('a'), false, 'too late to undo the first');
  assert.deepEqual(s.removals.waitingIds(), ['b']);
  s.clock.tick(UNDO_WINDOW_MS);
  await flushMicrotasks();
  assert.deepEqual(s.committed, ['a', 'b']);
});

test('removing the same item twice schedules one delete', async () => {
  const s = setup();
  s.removals.remove('a');
  s.removals.remove('a');
  s.clock.tick(UNDO_WINDOW_MS);
  await s.removals.flush();
  assert.deepEqual(s.committed, ['a']);
});

test('flush (teardown, app hidden) commits everything waiting now', async () => {
  const s = setup();
  s.removals.remove('a');
  await s.removals.flush();
  assert.deepEqual(s.committed, ['a']);
  assert.equal(s.clock.active, 0);
  // Nothing fires later.
  s.clock.tick(UNDO_WINDOW_MS);
  await flushMicrotasks();
  assert.deepEqual(s.committed, ['a']);
});

test('item stays hidden while its delete is in flight, and undo is refused', async () => {
  let release!: () => void;
  const s = setup(() => new Promise<void>((resolve) => (release = resolve)));
  s.removals.remove('a');
  const flushed = s.removals.flush();
  assert.equal(s.removals.isHidden('a'), true);
  assert.equal(s.removals.undo('a'), false);
  release();
  await flushed;
  assert.equal(s.removals.isHidden('a'), false);
});

test('a failed delete shows the item again and reports the error', async () => {
  const s = setup(async () => {
    throw new Error('disk full');
  });
  s.removals.remove('a');
  s.clock.tick(UNDO_WINDOW_MS);
  await flushMicrotasks();
  assert.deepEqual(s.errors, ['a']);
  assert.equal(s.removals.isHidden('a'), false);
  assert.deepEqual(s.removals.visible(books).map((x) => x.id), ['a', 'b', 'c']);
});

test('pause holds the delete; resume restarts the full window', async () => {
  const s = setup();
  s.removals.remove('a');
  s.clock.tick(UNDO_WINDOW_MS - 100);
  s.removals.pause('a');
  s.clock.tick(UNDO_WINDOW_MS * 3);
  await flushMicrotasks();
  assert.deepEqual(s.committed, []);
  s.removals.resume('a');
  s.clock.tick(UNDO_WINDOW_MS - 1);
  await flushMicrotasks();
  assert.deepEqual(s.committed, []);
  s.clock.tick(1);
  await flushMicrotasks();
  assert.deepEqual(s.committed, ['a']);
});

test('undo still works while paused, and flush commits a paused removal', async () => {
  const s = setup();
  s.removals.remove('a');
  s.removals.pause('a');
  assert.equal(s.removals.undo('a'), true);
  s.removals.remove('b');
  s.removals.pause('b');
  await s.removals.flush();
  assert.deepEqual(s.committed, ['b']);
});

test('commit(id) settles one removal early and ignores unknown ids', async () => {
  const s = setup();
  s.removals.remove('a');
  await s.removals.commit('zzz');
  await s.removals.commit('a');
  assert.deepEqual(s.committed, ['a']);
  await s.removals.commit('a');
  assert.deepEqual(s.committed, ['a'], 'never deletes twice');
});
