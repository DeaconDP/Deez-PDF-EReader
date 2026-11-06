import { getPdfBlob, getPdfMeta, updateProgress } from '../lib/library';
import { PdfRenderer, setupSwipe, setupZoomGestures } from '../lib/pdf-renderer';
import { AppError, ErrorCodes, errorCodeOf, escapeHtml, friendlyError } from '../lib/errors';
import { errorRecoveryOf } from '../lib/error-recovery';
import { browserHintStorage, markHintSeen, shouldShowHint } from '../lib/hint-once';
import { isTapGesture } from '../lib/tap-gesture';
import { pageBuddy } from '../components/illustration';
import { logger } from '../lib/logger';
import { loadReaderPrefs, saveReaderPrefs, type TextTheme } from '../lib/reader-prefs';
import { showLoading } from '../components/loading';
import { sym } from '../lib/symbols';

export type ReaderInput =
  | { mode: 'library'; pdfId: string }
  | { mode: 'preview'; blob: Blob; title: string; pdfUrl: string; resultId: string };

export type ReaderCallbacks = {
  onBack: () => void;
  onAddToLibrary?: () => void | Promise<void>;
  /** Remove a damaged/unreadable PDF from the library (offered on the error screen). */
  onRemoveFromLibrary?: (pdfId: string) => void | Promise<void>;
};

/** "Hide controls": corners pointing out, in the house icon style (see lib/symbols.ts). */
const HIDE_CONTROLS_ICON =
  '<svg class="svg-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/></svg>';

const HINT_PAGE_MODE = 'reader-page-gestures';
const HINT_TEXT_MODE = 'reader-text-options';

export type ReaderView = {
  view: HTMLElement;
  load: () => Promise<void>;
};

export function createReaderView(input: ReaderInput, callbacks: ReaderCallbacks): ReaderView {
  const isPreview = input.mode === 'preview';
  const pdfId = input.mode === 'library' ? input.pdfId : `preview:${input.resultId}`;
  const backLabel = isPreview ? 'Back to results' : 'Back to library';

  const view = document.createElement('div');
  view.className = 'view reader-view';

  view.innerHTML = `
    <button type="button" class="reader-show-chrome" hidden>Show controls</button>
    <p class="visually-hidden reader-announcer" role="status" aria-live="polite"></p>
    <header class="reader-header reader-chrome">
      <button type="button" class="btn-icon btn-back back-btn" aria-label="${backLabel}">
        <span class="icon" aria-hidden="true">${sym.back}</span>
        <span class="btn-back-label" aria-hidden="true">${isPreview ? 'Results' : 'Library'}</span>
      </button>
      <div class="reader-heading">
        <h1 class="pdf-title">Loading…</h1>
        ${isPreview ? '<span class="reader-preview-tag">Preview · not saved yet</span>' : ''}
      </div>
      <div class="reader-toolbar">
        ${
          isPreview
            ? `<button class="btn btn-primary btn-small reader-add-btn" type="button" aria-label="Add to library">
            <span class="icon" aria-hidden="true">${sym.add}</span>
            <span class="btn-label">Add</span>
          </button>`
            : ''
        }
        <div class="reader-toolbar-secondary">
          <button type="button" class="btn-icon text-mode-btn" aria-pressed="false" aria-label="Text mode">
            <span class="icon" aria-hidden="true">${sym.text}</span>
          </button>
          <div class="font-size-controls" hidden>
            <button type="button" class="btn-icon font-decrease-btn" aria-label="Smaller text">
              <span class="icon" aria-hidden="true">${sym.fontDecrease}</span>
            </button>
            <button type="button" class="btn-icon font-increase-btn" aria-label="Larger text">
              <span class="icon" aria-hidden="true">${sym.fontIncrease}</span>
            </button>
          </div>
          <button type="button" class="btn-icon text-theme-btn" hidden aria-pressed="false" aria-label="Dark page">
            <span class="icon text-theme-icon" aria-hidden="true">${sym.darkMode}</span>
          </button>
        </div>
        <button type="button" class="btn-icon reader-hide-chrome-btn" aria-label="Hide controls">
          <span class="icon" aria-hidden="true">${HIDE_CONTROLS_ICON}</span>
        </button>
        <div class="reader-toolbar-overflow">
          <button type="button" class="btn-icon reader-overflow-btn" aria-expanded="false" aria-haspopup="menu" aria-label="Reading options">
            <span class="icon" aria-hidden="true">${sym.more}</span>
          </button>
          <div class="reader-overflow-menu hidden" role="menu" aria-label="Reading options">
            <button type="button" class="reader-overflow-item reader-overflow-text-mode" role="menuitemcheckbox" aria-checked="false">
              <span class="icon" aria-hidden="true">${sym.text}</span>
              <span class="reader-overflow-label">Text mode</span>
              <span class="reader-overflow-check icon" aria-hidden="true">${sym.check}</span>
            </button>
            <button type="button" class="reader-overflow-item reader-overflow-font-decrease" role="menuitem" hidden>
              <span class="icon" aria-hidden="true">${sym.fontDecrease}</span>
              <span class="reader-overflow-label">Smaller text</span>
            </button>
            <button type="button" class="reader-overflow-item reader-overflow-font-increase" role="menuitem" hidden>
              <span class="icon" aria-hidden="true">${sym.fontIncrease}</span>
              <span class="reader-overflow-label">Larger text</span>
            </button>
            <button type="button" class="reader-overflow-item reader-overflow-theme" role="menuitem" hidden>
              <span class="icon reader-overflow-theme-icon" aria-hidden="true">${sym.darkMode}</span>
              <span class="reader-overflow-label">Dark page</span>
            </button>
          </div>
        </div>
      </div>
    </header>
    <div class="reader-progress reader-chrome" role="progressbar" aria-label="Reading progress" aria-valuemin="1" aria-valuenow="1" aria-valuemax="1" hidden>
      <div class="reader-progress-fill"></div>
    </div>
    <p class="reader-tips reader-chrome" hidden></p>
    <div class="reader-canvas-container">
      <div class="reader-canvas-wrapper">
        <canvas class="reader-canvas" role="img" aria-label="Page"></canvas>
        <div class="reader-text-panel" hidden></div>
      </div>
    </div>
    <nav class="reader-bottom-bar reader-chrome" aria-label="Pages">
      <div class="reader-toolbar-nav">
        <button type="button" class="btn btn-secondary btn-page prev-btn" aria-label="Previous page">
          <span class="icon" aria-hidden="true">${sym.prev}</span>
        </button>
        <span class="page-indicator" aria-live="polite">1 / 1</span>
        <button type="button" class="btn btn-primary btn-page next-btn" aria-label="Next page">
          <span class="icon" aria-hidden="true">${sym.next}</span>
        </button>
      </div>
    </nav>
    <div class="toast hidden" role="status" aria-live="polite"></div>
  `;

  const canvas = view.querySelector('.reader-canvas') as HTMLCanvasElement;
  const textPanel = view.querySelector('.reader-text-panel') as HTMLElement;
  const titleEl = view.querySelector('.pdf-title') as HTMLElement;
  const pageIndicator = view.querySelector('.page-indicator') as HTMLElement;
  const progressBar = view.querySelector('.reader-progress') as HTMLElement;
  const progressFill = view.querySelector('.reader-progress-fill') as HTMLElement;
  const backBtn = view.querySelector('.back-btn') as HTMLButtonElement;
  const addLibraryBtn = view.querySelector('.reader-add-btn') as HTMLButtonElement | null;
  const textModeBtn = view.querySelector('.text-mode-btn') as HTMLButtonElement;
  const fontSizeControls = view.querySelector('.font-size-controls') as HTMLElement;
  const fontDecreaseBtn = view.querySelector('.font-decrease-btn') as HTMLButtonElement;
  const fontIncreaseBtn = view.querySelector('.font-increase-btn') as HTMLButtonElement;
  const textThemeBtn = view.querySelector('.text-theme-btn') as HTMLButtonElement;
  const textThemeIcon = view.querySelector('.text-theme-icon') as HTMLElement;
  const prevBtn = view.querySelector('.prev-btn') as HTMLButtonElement;
  const nextBtn = view.querySelector('.next-btn') as HTMLButtonElement;
  const readerOverflowBtn = view.querySelector('.reader-overflow-btn') as HTMLButtonElement;
  const readerOverflowMenu = view.querySelector('.reader-overflow-menu') as HTMLElement;
  const readerOverflowTextMode = view.querySelector('.reader-overflow-text-mode') as HTMLButtonElement;
  const readerOverflowFontDecrease = view.querySelector('.reader-overflow-font-decrease') as HTMLButtonElement;
  const readerOverflowFontIncrease = view.querySelector('.reader-overflow-font-increase') as HTMLButtonElement;
  const readerOverflowTheme = view.querySelector('.reader-overflow-theme') as HTMLButtonElement;
  const canvasContainer = view.querySelector('.reader-canvas-container') as HTMLElement;
  const canvasWrapper = view.querySelector('.reader-canvas-wrapper') as HTMLElement;
  const readerTips = view.querySelector('.reader-tips') as HTMLElement;
  const toast = view.querySelector('.toast') as HTMLElement;
  const showChromeBtn = view.querySelector('.reader-show-chrome') as HTMLButtonElement;
  const hideChromeBtn = view.querySelector('.reader-hide-chrome-btn') as HTMLButtonElement;
  const announcer = view.querySelector('.reader-announcer') as HTMLElement;
  const chromeParts = Array.from(view.querySelectorAll<HTMLElement>('.reader-chrome'));

  const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const PAGE_MODE_TIPS = isTouch
    ? 'Swipe to turn pages · pinch to zoom'
    : 'Arrow keys turn pages · pinch or scroll to zoom';
  const TEXT_MODE_TIPS = 'Text size and page colour are in the options menu';

  // Each tip shows once only: it's marked seen as soon as it is on screen
  // after a successful load, stays up for that reading session, and goes away
  // at the first page turn. If storage is unavailable it just shows again.
  const hintStorage = browserHintStorage();
  const dismissedTips = new Set<string>();
  let documentReady = false;
  let errorShown = false;
  const shownTips = new Set<string>();

  function currentHint(): string {
    return view.classList.contains('text-mode') ? HINT_TEXT_MODE : HINT_PAGE_MODE;
  }

  function refreshReaderTips(): void {
    const textMode = view.classList.contains('text-mode');
    const hint = currentHint();
    readerTips.textContent = textMode ? TEXT_MODE_TIPS : PAGE_MODE_TIPS;
    const show =
      documentReady && !errorShown && !dismissedTips.has(hint) && (shownTips.has(hint) || shouldShowHint(hint, hintStorage));
    readerTips.hidden = !show;
    if (show && !shownTips.has(hint)) {
      shownTips.add(hint);
      markHintSeen(hint, hintStorage);
    }
  }

  function dismissReaderTips(): void {
    if (!documentReady) return;
    dismissedTips.add(currentHint());
    readerTips.hidden = true;
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(message: string, isError = false): void {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast ${isError ? 'toast-error' : 'toast-info'}`;
    toast.setAttribute('role', isError ? 'alert' : 'status');
    toastTimer = setTimeout(() => toast.classList.add('hidden'), isError ? 6000 : 4000);
  }

  const renderer = new PdfRenderer(canvas, textPanel, canvasContainer, canvasWrapper);
  const previousTitle = document.title;
  let prefs = loadReaderPrefs();
  let textTheme: TextTheme = prefs.textTheme;
  let cleanupSwipe: (() => void) | null = null;
  let cleanupZoom: (() => void) | null = null;
  let cleanupKeydown: (() => void) | null = null;
  let cleanupResize: (() => void) | null = null;
  let cleanupLayoutObserver: (() => void) | null = null;

  function persistPrefs(updates: Partial<typeof prefs>): void {
    prefs = { ...prefs, ...updates };
    saveReaderPrefs(prefs);
  }

  function applyTextTheme(theme: TextTheme): void {
    textTheme = theme;
    textPanel.classList.toggle('text-theme-dark', theme === 'dark');
    textPanel.classList.toggle('text-theme-light', theme === 'light');
    // The stage carries the paper colour too, so text mode is full-bleed paper.
    view.classList.toggle('text-theme-dark', theme === 'dark');
    view.classList.toggle('text-theme-light', theme === 'light');
    const themeLabel = theme === 'dark' ? 'Light page' : 'Dark page';
    const themeIcon = theme === 'dark' ? sym.lightMode : sym.darkMode;
    textThemeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    textThemeBtn.setAttribute('aria-label', themeLabel);
    textThemeBtn.classList.toggle('active', theme === 'dark');
    textThemeIcon.innerHTML = themeIcon;
    readerOverflowTheme.innerHTML = `<span class="icon reader-overflow-theme-icon" aria-hidden="true">${themeIcon}</span><span class="reader-overflow-label">${themeLabel}</span>`;
    persistPrefs({ textTheme: theme });
  }

  function saveFontScale(): void {
    persistPrefs({ fontScale: renderer.getFontScale() });
  }

  applyTextTheme(textTheme);

  function updatePageProgress(page: number, total: number): void {
    pageIndicator.textContent = `${page} / ${total}`;
    pageIndicator.setAttribute('aria-label', `Page ${page} of ${total}`);
    canvas.setAttribute('aria-label', `Page ${page} of ${total}. Turn on Text mode in Reading options to have it read aloud.`);
    const focused = document.activeElement;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = total > 0 && page >= total;
    // Don't drop keyboard/VoiceOver focus to <body> when a button disables itself.
    if (focused === nextBtn && nextBtn.disabled && !prevBtn.disabled) prevBtn.focus();
    if (focused === prevBtn && prevBtn.disabled && !nextBtn.disabled) nextBtn.focus();
    if (total > 0) {
      progressFill.style.width = `${(page / total) * 100}%`;
      progressBar.setAttribute('aria-valuenow', String(page));
      progressBar.setAttribute('aria-valuemax', String(total));
      progressBar.hidden = false;
    } else {
      progressBar.hidden = true;
    }
  }

  let lastPage = 0;
  renderer.setCallbacks(
    (page, total) => {
      if (lastPage && page !== lastPage) dismissReaderTips();
      lastPage = page;
      updatePageProgress(page, total);
    },
    async (page, total) => {
      if (isPreview) return;
      try {
        await updateProgress(pdfId, page, total);
        logger.debug(`Saved progress: page ${page}/${total}`);
      } catch (err) {
        logger.logError('Failed to save progress', err);
      }
    },
  );

  backBtn.addEventListener('click', () => {
    destroy();
    callbacks.onBack();
  });

  addLibraryBtn?.addEventListener('click', async () => {
    if (!callbacks.onAddToLibrary || addLibraryBtn.disabled) return;
    const label = addLibraryBtn.querySelector('.btn-label');
    addLibraryBtn.disabled = true;
    addLibraryBtn.setAttribute('aria-busy', 'true');
    if (label) label.textContent = 'Adding…';
    addLibraryBtn.setAttribute('aria-label', 'Adding to library');
    try {
      await callbacks.onAddToLibrary();
    } catch (err) {
      logger.logError('Failed to add preview to library', err);
      showToast(friendlyError(err), true);
      addLibraryBtn.disabled = false;
      addLibraryBtn.removeAttribute('aria-busy');
      if (label) label.textContent = 'Add';
      addLibraryBtn.setAttribute('aria-label', 'Add to library');
    }
  });

  prevBtn.addEventListener('click', () => renderer.prevPage());
  nextBtn.addEventListener('click', () => renderer.nextPage());

  function closeReaderOverflowMenu() {
    if (readerOverflowMenu.classList.contains('hidden')) return;
    const hadFocus = readerOverflowMenu.contains(document.activeElement);
    readerOverflowMenu.classList.add('hidden');
    readerOverflowBtn.setAttribute('aria-expanded', 'false');
    if (hadFocus) readerOverflowBtn.focus();
  }

  function openReaderOverflowMenu() {
    readerOverflowMenu.classList.remove('hidden');
    readerOverflowBtn.setAttribute('aria-expanded', 'true');
    readerOverflowMenu.querySelector<HTMLElement>('.reader-overflow-item:not([hidden])')?.focus();
  }

  readerOverflowBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (readerOverflowMenu.classList.contains('hidden')) {
      openReaderOverflowMenu();
    } else {
      closeReaderOverflowMenu();
    }
  });

  view.addEventListener('click', (e) => {
    if (!readerOverflowBtn.contains(e.target as Node) && !readerOverflowMenu.contains(e.target as Node)) {
      closeReaderOverflowMenu();
    }
  });

  function updateTextModeUi(enabled: boolean): void {
    view.classList.toggle('text-mode', enabled);
    textModeBtn.setAttribute('aria-pressed', String(enabled));
    textModeBtn.classList.toggle('active', enabled);
    readerOverflowTextMode.setAttribute('aria-checked', String(enabled));
    fontSizeControls.hidden = !enabled;
    textThemeBtn.hidden = !enabled;
    readerOverflowFontDecrease.hidden = !enabled;
    readerOverflowFontIncrease.hidden = !enabled;
    readerOverflowTheme.hidden = !enabled;
    canvas.hidden = enabled;
    textPanel.hidden = !enabled;
    refreshReaderTips();
  }

  async function toggleTextMode(): Promise<void> {
    const next = !renderer.isTextMode();
    await renderer.setTextMode(next);
    updateTextModeUi(next);
    persistPrefs({ textMode: next });
  }

  textModeBtn.addEventListener('click', () => {
    void toggleTextMode();
  });

  readerOverflowTextMode.addEventListener('click', () => {
    closeReaderOverflowMenu();
    void toggleTextMode();
  });

  textThemeBtn.addEventListener('click', () => {
    applyTextTheme(textTheme === 'dark' ? 'light' : 'dark');
  });

  readerOverflowTheme.addEventListener('click', () => {
    closeReaderOverflowMenu();
    applyTextTheme(textTheme === 'dark' ? 'light' : 'dark');
  });

  fontDecreaseBtn.addEventListener('click', () => {
    renderer.adjustFontSize(-1);
    saveFontScale();
  });
  fontIncreaseBtn.addEventListener('click', () => {
    renderer.adjustFontSize(1);
    saveFontScale();
  });

  readerOverflowFontDecrease.addEventListener('click', () => {
    closeReaderOverflowMenu();
    renderer.adjustFontSize(-1);
    saveFontScale();
  });
  readerOverflowFontIncrease.addEventListener('click', () => {
    closeReaderOverflowMenu();
    renderer.adjustFontSize(1);
    saveFontScale();
  });

  const onTextFontWheel = (e: WheelEvent) => {
    if (!renderer.isTextMode() || !e.ctrlKey) return;
    e.preventDefault();
    const step = Math.max(-3, Math.min(3, Math.round(-e.deltaY / 15)));
    if (step !== 0) {
      renderer.adjustFontSize(step);
      saveFontScale();
    }
  };
  canvasContainer.addEventListener('wheel', onTextFontWheel, { passive: false });

  cleanupSwipe = setupSwipe(
    canvasContainer,
    () => renderer.nextPage(),
    () => renderer.prevPage(),
    { shouldSwipe: () => renderer.getZoom() <= 1 },
  );

  cleanupZoom = setupZoomGestures(
    canvasContainer,
    () => renderer.getZoom(),
    (zoom, focal) => {
      if (renderer.isTextMode()) return;
      renderer.setZoom(zoom, focal);
    },
  );

  // ── Hidden-chrome mode: the page is the hero ──────────────────
  // Header, progress, tips and the bottom bar slide away (CSS, tokenized
  // timing) and are taken out of the flow, so the stage grows; the
  // ResizeObserver below then re-fits the page. Hidden parts are `inert`.
  let chromeHidden = false;
  let announceTimer: ReturnType<typeof setTimeout> | undefined;

  function announce(message: string): void {
    clearTimeout(announceTimer);
    announcer.textContent = '';
    // Clear first so the same message is announced again.
    announceTimer = setTimeout(() => {
      announcer.textContent = message;
    }, 50);
  }

  function setChromeHidden(hidden: boolean, options: { announce?: boolean } = {}): void {
    if (hidden === chromeHidden) return;
    if (hidden && (errorShown || !documentReady)) return;
    if (hidden) closeReaderOverflowMenu();
    const focusWasInChrome = chromeParts.some((part) => part.contains(document.activeElement));
    const focusWasOnShow = document.activeElement === showChromeBtn;
    chromeHidden = hidden;
    view.classList.toggle('chrome-hidden', hidden);
    for (const part of chromeParts) part.inert = hidden;
    showChromeBtn.hidden = !hidden;
    if (hidden && focusWasInChrome) showChromeBtn.focus();
    if (!hidden && focusWasOnShow) hideChromeBtn.focus();
    if (options.announce !== false) {
      announce(hidden ? 'Controls hidden. Tap the page to show them.' : 'Controls shown.');
    }
  }

  hideChromeBtn.addEventListener('click', () => setChromeHidden(true));
  showChromeBtn.addEventListener('click', () => setChromeHidden(false));

  // A tap on the page toggles the chrome. Swipes (moved), pinches (two
  // pointers), long presses / text selection and browser-handled scrolls
  // (pointercancel) don't count, and neither does a tap while zoomed in.
  type Gesture = {
    id: number;
    x: number;
    y: number;
    start: number;
    end?: number;
    maxDistance: number;
    maxPointers: number;
    cancelled: boolean;
    hadSelection: boolean;
  };
  let gesture: Gesture | null = null;
  const activePointers = new Set<number>();

  function hasTextSelection(): boolean {
    const selection = window.getSelection();
    return !!selection && !selection.isCollapsed && selection.toString().trim() !== '';
  }

  const onStagePointerDown = (e: PointerEvent) => {
    activePointers.add(e.pointerId);
    if (activePointers.size === 1) {
      gesture = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        start: e.timeStamp,
        maxDistance: 0,
        maxPointers: 1,
        cancelled: e.button !== 0,
        hadSelection: hasTextSelection(),
      };
    } else if (gesture) {
      gesture.maxPointers = Math.max(gesture.maxPointers, activePointers.size);
    }
  };

  const onStagePointerMove = (e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    gesture.maxDistance = Math.max(gesture.maxDistance, Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y));
  };

  const onStagePointerUp = (e: PointerEvent) => {
    activePointers.delete(e.pointerId);
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    g.maxDistance = Math.max(g.maxDistance, Math.hypot(e.clientX - g.x, e.clientY - g.y));
    g.end = e.timeStamp;
    if (activePointers.size > 0) return;
    gesture = null;
    const tap = isTapGesture({
      maxDistance: g.maxDistance,
      durationMs: g.end - g.start,
      maxPointers: g.maxPointers,
      cancelled: g.cancelled,
    });
    if (!tap || g.hadSelection || hasTextSelection()) return;
    if (renderer.getZoom() > 1 || errorShown || !documentReady) return;
    setChromeHidden(!chromeHidden);
  };

  const onStagePointerCancel = (e: PointerEvent) => {
    activePointers.delete(e.pointerId);
    if (gesture) gesture.cancelled = true;
    if (activePointers.size === 0) gesture = null;
  };

  canvasContainer.addEventListener('pointerdown', onStagePointerDown);
  canvasContainer.addEventListener('pointermove', onStagePointerMove);
  canvasContainer.addEventListener('pointerup', onStagePointerUp);
  canvasContainer.addEventListener('pointercancel', onStagePointerCancel);

  function removeStageTapListeners(): void {
    canvasContainer.removeEventListener('pointerdown', onStagePointerDown);
    canvasContainer.removeEventListener('pointermove', onStagePointerMove);
    canvasContainer.removeEventListener('pointerup', onStagePointerUp);
    canvasContainer.removeEventListener('pointercancel', onStagePointerCancel);
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && chromeHidden) {
      e.preventDefault();
      setChromeHidden(false);
      return;
    }
    const menuOpen = !readerOverflowMenu.classList.contains('hidden');
    if (menuOpen && e.key !== 'Escape') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      renderer.nextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      renderer.prevPage();
    } else if (e.key === 'Escape') {
      if (!readerOverflowMenu.classList.contains('hidden')) {
        closeReaderOverflowMenu();
        readerOverflowBtn.focus();
        return;
      }
      destroy();
      callbacks.onBack();
    }
  };
  document.addEventListener('keydown', onKeydown);
  cleanupKeydown = () => document.removeEventListener('keydown', onKeydown);

  // Re-fit the page to the stage on resize, rotation and chrome toggles.
  // Text mode reflows by itself; re-rendering it would jump back to the top.
  let resizeTimer: ReturnType<typeof setTimeout>;
  const refit = () => {
    if (!renderer.isTextMode()) void renderer.resize();
  };
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refit, 150);
  };
  window.addEventListener('resize', onResize);
  cleanupResize = () => window.removeEventListener('resize', onResize);

  const layoutObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refit, 50);
  });
  layoutObserver.observe(canvasContainer);
  cleanupLayoutObserver = () => layoutObserver.disconnect();

  function destroy() {
    document.title = previousTitle;
    cleanupSwipe?.();
    cleanupZoom?.();
    cleanupKeydown?.();
    cleanupResize?.();
    cleanupLayoutObserver?.();
    canvasContainer.removeEventListener('wheel', onTextFontWheel);
    removeStageTapListeners();
    clearTimeout(announceTimer);
    renderer.destroy();
  }

  view.addEventListener('remove', destroy);

  function showError(err: unknown): void {
    setChromeHidden(false, { announce: false });
    errorShown = true;
    view.classList.add('reader-has-error');
    const stage = view.querySelector('.reader-canvas-container') as HTMLElement;
    const bottomBar = view.querySelector('.reader-bottom-bar') as HTMLElement;
    stage.hidden = true;
    bottomBar.hidden = true;
    readerTips.hidden = true;

    // Damaged, protected or unreadable files can't be fixed by trying again:
    // offer to remove them (library) or just go back (preview).
    const permanent = errorRecoveryOf(err) === 'remove';
    const canRemove = permanent && !isPreview && !!callbacks.onRemoveFromLibrary;
    const unreadable = errorCodeOf(err) === ErrorCodes.PDF_003;
    let hint = '';
    if (permanent && !isPreview) {
      hint = unreadable
        ? 'Remove it from your library, then add the file again.'
        : 'If you have a working copy, remove this one and add it again.';
    }

    const primaryAction = canRemove
      ? `<button type="button" class="btn btn-secondary btn-remove remove-error-btn">
          <span class="icon" aria-hidden="true">${sym.remove}</span><span class="btn-label">Remove from library</span>
        </button>`
      : permanent
        ? ''
        : `<button type="button" class="btn btn-primary retry-btn">
          <span class="icon" aria-hidden="true">${sym.refresh}</span><span class="btn-label">Try again</span>
        </button>`;
    const backClass = primaryAction ? 'btn-secondary' : 'btn-primary';

    const box = document.createElement('div');
    box.className = 'error-state';
    box.setAttribute('role', 'alert');
    box.innerHTML = `
      <div class="error-illustration" aria-hidden="true">${pageBuddy('sad', 120)}</div>
      <h2 class="error-title">We couldn’t open this one</h2>
      <p class="error-detail">${escapeHtml(friendlyError(err))}</p>
      ${hint ? `<p class="error-hint">${escapeHtml(hint)}</p>` : ''}
      <div class="error-actions">
        ${primaryAction}
        <button type="button" class="btn ${backClass} back-error-btn">
          <span class="icon" aria-hidden="true">${sym.back}</span><span class="btn-label">${backLabel}</span>
        </button>
      </div>
    `;
    stage.after(box);
    box.querySelector('.back-error-btn')?.addEventListener('click', () => {
      destroy();
      callbacks.onBack();
    });
    const removeBtn = box.querySelector('.remove-error-btn') as HTMLButtonElement | null;
    removeBtn?.addEventListener('click', async () => {
      if (removeBtn.disabled || !callbacks.onRemoveFromLibrary) return;
      removeBtn.disabled = true;
      removeBtn.setAttribute('aria-busy', 'true');
      try {
        await callbacks.onRemoveFromLibrary(pdfId);
      } catch (removeErr) {
        logger.logError('Failed to remove PDF from the error screen', removeErr);
        showToast(friendlyError(removeErr), true);
        removeBtn.disabled = false;
        removeBtn.removeAttribute('aria-busy');
      }
    });
    box.querySelector('.retry-btn')?.addEventListener('click', () => {
      box.remove();
      stage.hidden = false;
      bottomBar.hidden = false;
      view.classList.remove('reader-has-error');
      errorShown = false;
      void load();
    });
    (box.querySelector('.error-actions .btn') as HTMLElement | null)?.focus();
  }

  async function load(): Promise<void> {
    if (errorShown) return;
    documentReady = false;
    readerTips.hidden = true;
    const hideLoading = showLoading(view, isPreview ? 'Fetching the preview…' : 'Opening your PDF…');
    canvas.classList.remove('rendered');
    textPanel.classList.remove('rendered');
    try {
      let blob: Blob;
      let title: string;
      let startPage = 1;

      if (input.mode === 'library') {
        const meta = await getPdfMeta(input.pdfId);
        if (!meta) throw new AppError(ErrorCodes.PDF_003, 'record missing');
        title = meta.name;
        startPage = meta.currentPage;
        blob = await getPdfBlob(input.pdfId);
      } else {
        title = input.title;
        blob = input.blob;
      }

      titleEl.textContent = title;
      document.title = `${title} — DeezPDF`;
      await renderer.load(blob, pdfId, startPage);
      renderer.setFontScale(prefs.fontScale);
      if (prefs.textMode) {
        await renderer.setTextMode(true);
        updateTextModeUi(true);
      }
      if (renderer.isTextMode()) {
        textPanel.classList.add('rendered');
      } else {
        canvas.classList.add('rendered');
      }
      documentReady = true;
      refreshReaderTips();
    } catch (err) {
      logger.logError('Failed to open PDF', err);
      showError(err);
    } finally {
      hideLoading();
    }
  }

  return { view, load };
}

