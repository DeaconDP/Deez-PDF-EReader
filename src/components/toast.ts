/**
 * The one toast used by every view: a polite status message (`role=alert`
 * for errors) with an optional action button such as Undo.
 *
 * The timer pauses while the pointer is over the toast or focus is inside it
 * (WCAG 2.2.1), and restarts in full once it leaves. Showing a new message
 * replaces the current one and resets the timer.
 */

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
  element.className = 'toast hidden';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.replaceChildren();

  const messageEl = document.createElement('span');
  messageEl.className = 'toast-message';
  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className = 'toast-action';
  actionBtn.hidden = true;
  element.append(messageEl, actionBtn);

  let current: { token: number; options: ToastOptions } | null = null;
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
    element.classList.add('hidden');
    actionBtn.hidden = true;
    closing.options.onDismiss?.(reason);
  }

  actionBtn.addEventListener('click', () => {
    const action = current?.options.action;
    if (!action) return;
    close('action');
    action.onAction();
  });

  element.addEventListener('mouseenter', () => {
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
    if (current) close('replaced');
    const token = nextToken++;
    current = { token, options };

    const isError = Boolean(options.isError);
    messageEl.textContent = message;
    element.classList.toggle('toast-error', isError);
    element.classList.toggle('toast-info', !isError);
    element.classList.toggle('toast-has-action', Boolean(options.action));
    element.setAttribute('role', isError ? 'alert' : 'status');

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
    element.classList.remove('hidden');
    // A pointer still resting where the toast appears keeps it paused.
    hovered = element.matches(':hover');
    if (hovered) syncPause();
    else startTimer();

    return {
      dismiss: () => {
        if (current?.token === token) close('dismissed');
      },
      isActive: () => current?.token === token,
    };
  }

  return {
    element,
    show,
    hide: () => close('dismissed'),
  };
}
