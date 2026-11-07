/**
 * The one toast used by every view: a polite status message (an alert for
 * errors) with an optional action button such as Undo.
 *
 * The timer pauses while focus is inside the toast, or the pointer is over it
 * on devices that can hover (WCAG 2.2.1), and restarts in full once it leaves.
 * Showing a new message replaces the current one and resets the timer, except
 * that a toast with an action (Undo) is never cut short by a message without
 * one: that message waits until the action toast ends (see toast-queue.ts).
 *
 * Announcements: the toast is never `display: none`. When idle it is only
 * transparent, so its two live regions (one `role=status`, one `role=alert`)
 * stay in the accessibility tree and a message is set into a region that is
 * already there. Each region keeps its role; the empty one is visually hidden.
 */

import { showsQueuedAfter, toastArrival } from '../lib/toast-queue';

export const TOAST_DURATION_MS = 4000;

/**
 * Bottom chrome the toast must sit above: the library's tab bar and Add
 * button (marked `data-toast-floor`) and the reader's bottom bar. With none
 * on screen it rests on the bottom safe area (see `.toast` in app.css).
 */
const TOAST_FLOOR_SELECTOR = '[data-toast-floor], .reader-bottom-bar';
export const TOAST_ERROR_DURATION_MS = 6000;

export type ToastAction = {
  /** Visible label, e.g. "Undo". */
  label: string;
  /** Fuller name for VoiceOver; must start with the visible label (e.g. "Undo removing “Dune”"). */
  accessibleLabel?: string;
  onAction: () => void;
};

export type ToastDismissReason = 'timeout' | 'action' | 'replaced' | 'dismissed';

export type ToastOptions = {
  isError?: boolean;
  action?: ToastAction;
  /** Milliseconds on screen. `null` keeps it up until dismissed or replaced. */
  duration?: number | null;
  /** Called when hover/focus pauses or releases the toast. */
  onPauseChange?: (paused: boolean) => void;
  /** Called once when this message leaves the screen, with why. */
  onDismiss?: (reason: ToastDismissReason) => void;
};

export type ToastHandle = {
  /** Hide this message if it is still the one showing. */
  dismiss: () => void;
  isActive: () => boolean;
};

export type Toaster = {
  element: HTMLElement;
  show: (message: string, options?: ToastOptions) => ToastHandle;
  /** Hide whatever is showing. */
  hide: () => void;
};

/**
 * Creates a toast. Pass an existing `.toast` element from the view's markup to
 * adopt it in place (keeps placement); otherwise append `element` yourself.
 */
export function createToaster(existing?: HTMLElement): Toaster {
  const element = existing ?? document.createElement('div');
  element.className = 'toast toast-idle';
  // The live regions are the message nodes inside, not the toast itself.
  element.removeAttribute('role');
  element.removeAttribute('aria-live');
  element.replaceChildren();

  const statusEl = document.createElement('span');
  statusEl.className = 'toast-message';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  statusEl.setAttribute('aria-atomic', 'true');
  const alertEl = document.createElement('span');
  alertEl.className = 'toast-message';
  alertEl.setAttribute('role', 'alert');
  alertEl.setAttribute('aria-live', 'assertive');
  alertEl.setAttribute('aria-atomic', 'true');
  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className = 'toast-action';
  actionBtn.hidden = true;
  element.append(statusEl, alertEl, actionBtn);

  const canHover = typeof window.matchMedia === 'function' ? window.matchMedia('(hover: hover)') : null;

  let current: { token: number; options: ToastOptions } | null = null;
  /** The newest message waiting for an action toast to end. */
  let queued: { token: number; message: string; options: ToastOptions } | null = null;
  let nextToken = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hovered = false;
  let focused = false;
  let paused = false;

  function durationOf(options: ToastOptions): number | null {
    if (options.duration !== undefined) return options.duration;
    return options.isError ? TOAST_ERROR_DURATION_MS : TOAST_DURATION_MS;
  }

  function startTimer() {
    clearTimeout(timer);
    timer = undefined;
    if (!current || paused) return;
    const ms = durationOf(current.options);
    if (ms === null || !Number.isFinite(ms)) return;
    const token = current.token;
    timer = setTimeout(() => {
      if (current?.token === token) close('timeout');
    }, ms);
  }

  function syncPause() {
    const next = Boolean(current) && (hovered || focused);
    if (next === paused) return;
    paused = next;
    current?.options.onPauseChange?.(paused);
    if (paused) {
      clearTimeout(timer);
      timer = undefined;
    } else {
      startTimer();
    }
  }

  function close(reason: ToastDismissReason) {
    const closing = current;
    if (!closing) return;
    clearTimeout(timer);
    timer = undefined;
    current = null;
    hovered = false;
    focused = false;
    if (paused) {
      paused = false;
      closing.options.onPauseChange?.(false);
    }
    // Don't leave focus on a button that is about to disappear.
    if (element.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    element.classList.add('toast-idle');
    actionBtn.hidden = true;
    statusEl.textContent = '';
    alertEl.textContent = '';
    closing.options.onDismiss?.(reason);
    if (!current && queued && showsQueuedAfter(reason)) {
      const next = queued;
      queued = null;
      present(next.token, next.message, next.options);
    }
  }

  actionBtn.addEventListener('click', () => {
    const action = current?.options.action;
    if (!action) return;
    close('action');
    action.onAction();
  });

  // Hover-pause only where hovering exists: on iOS a tap on the text fires
  // mouseenter with no mouseleave, which would hold the Undo clock forever.
  element.addEventListener('mouseenter', () => {
    if (!canHover?.matches) return;
    hovered = true;
    syncPause();
  });
  element.addEventListener('mouseleave', () => {
    hovered = false;
    syncPause();
  });
  element.addEventListener('focusin', () => {
    focused = true;
    syncPause();
  });
  element.addEventListener('focusout', (e) => {
    if (e.relatedTarget instanceof Node && element.contains(e.relatedTarget)) return;
    focused = false;
    syncPause();
  });

  /** Lift the toast above whatever bottom chrome is showing in its view. */
  function place() {
    const scope: ParentNode = element.closest('.view') ?? document;
    const viewportBottom = window.innerHeight;
    let floorTop = Infinity;
    scope.querySelectorAll<HTMLElement>(TOAST_FLOOR_SELECTOR).forEach((el) => {
      const rect = el.getBoundingClientRect();
      // Skip hidden chrome, and chrome slid off the bottom (the reader's hidden bar).
      if (rect.height === 0 || rect.top >= viewportBottom - 1) return;
      if (getComputedStyle(el).visibility === 'hidden') return;
      floorTop = Math.min(floorTop, rect.top);
    });
    if (Number.isFinite(floorTop)) {
      element.style.setProperty('--toast-floor', `${Math.round(viewportBottom - floorTop)}px`);
    } else {
      element.style.removeProperty('--toast-floor');
    }
  }

  function show(message: string, options: ToastOptions = {}): ToastHandle {
    const token = nextToken++;
    const arrival = toastArrival(
      current && { hasAction: Boolean(current.options.action) },
      { hasAction: Boolean(options.action) },
    );
    if (arrival === 'queue') {
      queued?.options.onDismiss?.('replaced');
      queued = { token, message, options };
    } else {
      if (arrival === 'replace') close('replaced');
      present(token, message, options);
    }

    return {
      dismiss: () => {
        if (current?.token === token) close('dismissed');
        else if (queued?.token === token) {
          queued = null;
          options.onDismiss?.('dismissed');
        }
      },
      isActive: () => current?.token === token,
    };
  }

  function present(token: number, message: string, options: ToastOptions) {
    current = { token, options };

    const isError = Boolean(options.isError);
    // The regions are already in the tree; only their text changes.
    (isError ? statusEl : alertEl).textContent = '';
    (isError ? alertEl : statusEl).textContent = message;
    element.classList.toggle('toast-error', isError);
    element.classList.toggle('toast-info', !isError);
    element.classList.toggle('toast-has-action', Boolean(options.action));

    if (options.action) {
      actionBtn.textContent = options.action.label;
      if (options.action.accessibleLabel) {
        actionBtn.setAttribute('aria-label', options.action.accessibleLabel);
      } else {
        actionBtn.removeAttribute('aria-label');
      }
      actionBtn.hidden = false;
    } else {
      actionBtn.hidden = true;
    }

    place();
    element.classList.remove('toast-idle');
    // A mouse still resting where the toast appears keeps it paused.
    hovered = Boolean(canHover?.matches) && element.matches(':hover');
    if (hovered) syncPause();
    else startTimer();
  }

  return {
    element,
    show,
    hide: () => {
      if (queued) {
        const dropped = queued;
        queued = null;
        dropped.options.onDismiss?.('dismissed');
      }
      close('dismissed');
    },
  };
}
