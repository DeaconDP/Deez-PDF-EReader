/**
 * Deferred "remove with Undo" for the library.
 *
 * A removed item is hidden at once, but its stored data is only deleted when
 * the Undo window runs out (or is cut short by `flush`, e.g. when the view
 * goes away or the app is backgrounded). If the app is killed inside the
 * window the delete never runs and the book simply stays, which is safe.
 *
 * One removal waits at a time: removing a second item commits the first
 * straight away, because the toast that offered its Undo is being replaced.
 *
 * Pure module (no DOM): timers are injectable so it can be tested.
 */

/** How long Undo is offered after a removal. */
export const UNDO_WINDOW_MS = 6000;

export type TimerFns = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export type PendingRemovalOptions = {
  /** Deletes the stored data. Rejecting puts the item back. */
  commit: (id: string) => Promise<void>;
  delayMs?: number;
  timers?: TimerFns;
  /** Called whenever the set of hidden ids changes. */
  onChange?: () => void;
  onCommitted?: (id: string) => void;
  onCommitError?: (id: string, err: unknown) => void;
};

export type PendingRemovals = {
  /** Hide `id` now and schedule its delete. Commits any other waiting removal first. */
  remove: (id: string) => void;
  /** Cancel a waiting removal. False if it was not waiting (unknown, or already committing). */
  undo: (id: string) => boolean;
  /** Stop the clock (e.g. while the Undo button has focus). */
  pause: (id: string) => void;
  /** Restart the full window after a pause. */
  resume: (id: string) => void;
  /** Commit this removal now (its Undo toast went away). No-op if it isn't pending. */
  commit: (id: string) => Promise<void>;
  /** Commit every waiting removal now. Resolves when all commits have settled. */
  flush: () => Promise<void>;
  /** True while the item is waiting or being deleted: keep it out of every list. */
  isHidden: (id: string) => boolean;
  /** `items` without the hidden ones. */
  visible: <T extends { id: string }>(items: readonly T[]) => T[];
  /** Ids still inside their Undo window. */
  waitingIds: () => string[];
};

type Entry =
  | { state: 'waiting'; timer: unknown; paused: boolean }
  | { state: 'committing'; done: Promise<void> };

const defaultTimers: TimerFns = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createPendingRemovals(options: PendingRemovalOptions): PendingRemovals {
  const delayMs = options.delayMs ?? UNDO_WINDOW_MS;
  const timers = options.timers ?? defaultTimers;
  const entries = new Map<string, Entry>();

  function changed() {
    options.onChange?.();
  }

  function schedule(id: string): unknown {
    return timers.setTimeout(() => {
      void commitNow(id);
    }, delayMs);
  }

  function commitNow(id: string): Promise<void> {
    const entry = entries.get(id);
    if (!entry) return Promise.resolve();
    if (entry.state === 'committing') return entry.done;
    if (entry.timer !== undefined) timers.clearTimeout(entry.timer);

    const done = (async () => {
      try {
        await options.commit(id);
        entries.delete(id);
        changed();
        options.onCommitted?.(id);
      } catch (err) {
        // The data is still there: show the item again.
        entries.delete(id);
        changed();
        options.onCommitError?.(id, err);
      }
    })();
    entries.set(id, { state: 'committing', done });
    return done;
  }

  return {
    remove(id) {
      const existing = entries.get(id);
      if (existing) return;
      for (const [otherId, entry] of entries) {
        if (entry.state === 'waiting') void commitNow(otherId);
      }
      entries.set(id, { state: 'waiting', timer: schedule(id), paused: false });
      changed();
    },

    undo(id) {
      const entry = entries.get(id);
      if (!entry || entry.state !== 'waiting') return false;
      if (entry.timer !== undefined) timers.clearTimeout(entry.timer);
      entries.delete(id);
      changed();
      return true;
    },

    pause(id) {
      const entry = entries.get(id);
      if (!entry || entry.state !== 'waiting' || entry.paused) return;
      if (entry.timer !== undefined) timers.clearTimeout(entry.timer);
      entries.set(id, { state: 'waiting', timer: undefined, paused: true });
    },

    resume(id) {
      const entry = entries.get(id);
      if (!entry || entry.state !== 'waiting' || !entry.paused) return;
      entries.set(id, { state: 'waiting', timer: schedule(id), paused: false });
    },

    commit: commitNow,

    async flush() {
      const pending = [...entries.keys()].map((id) => commitNow(id));
      await Promise.all(pending);
    },

    isHidden(id) {
      return entries.has(id);
    },

    visible(items) {
      if (entries.size === 0) return [...items];
      return items.filter((item) => !entries.has(item.id));
    },

    waitingIds() {
      return [...entries].filter(([, e]) => e.state === 'waiting').map(([id]) => id);
    },
  };
}
