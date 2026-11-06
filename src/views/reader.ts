import { getPdfBlob, getPdfMeta, updateProgress } from '../lib/library';
import { PdfRenderer, setupSwipe, setupZoomGestures } from '../lib/pdf-renderer';
import { ErrorCodes, errorCodeOf, friendlyError } from '../lib/errors';
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
};

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
    <header class="reader-header">
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
            ? `<button class="btn btn-primary btn-small reader-add-btn" type="button">
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
    <div class="reader-progress" role="progressbar" aria-label="Reading progress" aria-valuemin="1" aria-valuenow="1" aria-valuemax="1" hidden>
      <div class="reader-progress-fill"></div>
    </div>
    <p class="reader-tips"></p>
    <div class="reader-canvas-container">
      <div class="reader-canvas-wrapper">
        <canvas class="reader-canvas" role="img" aria-label="Page"></canvas>
        <div class="reader-text-panel" hidden></div>
      </div>
    </div>
    <nav class="reader-bottom-bar" aria-label="Pages">
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

  const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const PAGE_MODE_TIPS = isTouch
    ? 'Swipe to turn pages · pinch to zoom'
    : 'Arrow keys turn pages · pinch or scroll to zoom';
  const TEXT_MODE_TIPS = 'Text size and page colour are in the options menu';

  function updateReaderTips(textMode: boolean): void {
    readerTips.textContent = textMode ? TEXT_MODE_TIPS : PAGE_MODE_TIPS;
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
  updateReaderTips(false);

  function updatePageProgress(page: number, total: number): void {
    pageIndicator.textContent = `${page} / ${total}`;
    pageIndicator.setAttribute('aria-label', `Page ${page} of ${total}`);
    canvas.setAttribute('aria-label', `Page ${page} of ${total}. Turn on Text mode in Reading options to have it read aloud.`);
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = total > 0 && page >= total;
    if (total > 0) {
      progressFill.style.width = `${(page / total) * 100}%`;
      progressBar.setAttribute('aria-valuenow', String(page));
      progressBar.setAttribute('aria-valuemax', String(total));
      progressBar.hidden = false;
    } else {
      progressBar.hidden = true;
    }
  }

  renderer.setCallbacks(
    (page, total) => {
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
    try {
      await callbacks.onAddToLibrary();
    } catch (err) {
      logger.logError('Failed to add preview to library', err);
      showToast(friendlyError(err), true);
      addLibraryBtn.disabled = false;
      addLibraryBtn.removeAttribute('aria-busy');
      if (label) label.textContent = 'Add';
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
    updateReaderTips(enabled);
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

  const onKeydown = (e: KeyboardEvent) => {
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

  let resizeTimer: ReturnType<typeof setTimeout>;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderer.resize(), 150);
  };
  window.addEventListener('resize', onResize);
  cleanupResize = () => window.removeEventListener('resize', onResize);

  const layoutObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderer.resize(), 50);
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
    renderer.destroy();
  }

  view.addEventListener('remove', destroy);

  function showError(message: string, hint: string): void {
    errorShown = true;
    view.classList.add('reader-has-error');
    const stage = view.querySelector('.reader-canvas-container') as HTMLElement;
    stage.hidden = true;
    view.querySelector('.reader-bottom-bar')?.setAttribute('hidden', '');
    readerTips.hidden = true;
    const box = document.createElement('div');
    box.className = 'error-state';
    box.setAttribute('role', 'alert');
    box.innerHTML = `
      <div class="error-illustration" aria-hidden="true">${pageBuddy('sad', 120)}</div>
      <h2 class="error-title">We couldn’t open this one</h2>
      <p class="error-detail">${escapeHtml(message)}</p>
      ${hint ? `<p class="error-hint">${escapeHtml(hint)}</p>` : ''}
      <div class="error-actions">
        <button type="button" class="btn btn-primary retry-btn">
          <span class="icon" aria-hidden="true">${sym.refresh}</span><span class="btn-label">Try again</span>
        </button>
        <button type="button" class="btn btn-secondary back-error-btn">
          <span class="icon" aria-hidden="true">${sym.back}</span><span class="btn-label">${backLabel}</span>
        </button>
      </div>
    `;
    stage.after(box);
    box.querySelector('.back-error-btn')?.addEventListener('click', () => {
      destroy();
      callbacks.onBack();
    });
    box.querySelector('.retry-btn')?.addEventListener('click', () => {
      box.remove();
      stage.hidden = false;
      view.querySelector('.reader-bottom-bar')?.removeAttribute('hidden');
      readerTips.hidden = false;
      view.classList.remove('reader-has-error');
      errorShown = false;
      void load();
    });
    (box.querySelector('.retry-btn') as HTMLElement | null)?.focus();
  }

  let errorShown = false;

  async function load(): Promise<void> {
    if (errorShown) return;
    const hideLoading = showLoading(view, isPreview ? 'Fetching the preview…' : 'Opening your PDF…');
    canvas.classList.remove('rendered');
    textPanel.classList.remove('rendered');
    try {
      let blob: Blob;
      let title: string;
      let startPage = 1;

      if (input.mode === 'library') {
        const meta = await getPdfMeta(input.pdfId);
        if (!meta) throw new Error('PDF not found');
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
    } catch (err) {
      logger.logError('Failed to open PDF', err);
      const unreadable = errorCodeOf(err) === ErrorCodes.PDF_003;
      showError(friendlyError(err), unreadable ? 'Remove it from your library, then add the file again.' : '');
    } finally {
      hideLoading();
    }
  }

  return { view, load };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
