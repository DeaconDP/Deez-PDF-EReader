import {
  addPdfFiles,
  downloadAndAddPdf,
  getAllPdfs,
  queryPdfs,
  removePdf,
  renamePdf,
  supportsSaveFilePicker,
  type PdfMeta,
} from '../lib/library';
import {
  DEFAULT_LIBRARY_PREFS,
  FILTER_OPTIONS,
  SORT_OPTIONS,
  effectiveLibraryPrefs,
  isDefaultLibraryPrefs,
  isLibraryFilter,
  isLibrarySort,
  parseLibraryPrefs,
  showsSortFilter,
  type LibraryPrefs,
} from '../lib/library-prefs';
import { errorDetailOf, escapeHtml, friendlyError } from '../lib/errors';
import { logger } from '../lib/logger';
import { showLoading } from '../components/loading';
import { brandLogoSrc } from '../lib/brand';
import { sym } from '../lib/symbols';
import { createLookupPanel } from './lookup';
import { pageBuddy } from '../components/illustration';
import { onCreditClick } from '../components/debug-panel';
import type { LookupResult } from '../lib/lookup/types';
import { createToaster, type ToastHandle } from '../components/toast';
import { createPendingRemovals } from '../lib/pending-removal';

export type LibraryTab = 'library' | 'find';

export type LibraryCallbacks = {
  onOpenPdf: (id: string) => void;
  onPreview: (result: LookupResult, blob: Blob) => void;
};

export type LibraryOptions = {
  initialTab?: LibraryTab;
  /** Message to show once the library appears (e.g. after adding from a preview). */
  toast?: string;
  /**
   * Hide this PDF straight away and offer Undo (e.g. "Remove from library" on
   * the reader's error screen). Its data is deleted when the Undo window ends.
   */
  removePdfId?: string;
};

const PREFS_KEY = 'deezpdf-library-prefs';
const TAB_KEY = 'deezpdf-library-tab';

function loadPrefs(): LibraryPrefs {
  try {
    // Sorts that are no longer offered fall back to the default here.
    return parseLibraryPrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return { ...DEFAULT_LIBRARY_PREFS };
  }
}

function savePrefs(prefs: LibraryPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function radioOption(value: string, label: string): string {
  return `
    <button type="button" class="sheet-radio" role="radio" aria-checked="false" tabindex="-1" data-value="${value}">
      <span class="sheet-radio-label">${label}</span>
      <span class="sheet-radio-check icon" aria-hidden="true">${sym.check}</span>
    </button>`;
}

function loadTab(): LibraryTab {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (raw === 'library' || raw === 'find') return raw;
  } catch {
    /* ignore */
  }
  return 'library';
}

function saveTab(tab: LibraryTab) {
  localStorage.setItem(TAB_KEY, tab);
}

export function createLibraryView(
  callbacks: LibraryCallbacks,
  options?: LibraryOptions,
): HTMLElement {
  const view = document.createElement('div');
  view.className = 'view library-view app-shell';

  view.innerHTML = `
    <header class="library-shell-header">
      <div class="library-brand">
        <div class="brand-mark brand-mark-compact">
          <img class="brand-logo" src="${brandLogoSrc}" width="32" height="32" alt="" aria-hidden="true" />
        </div>
        <h1 class="logo logo-compact">Deez<span class="accent">PDF</span></h1>
      </div>
    </header>

    <div class="library-main">
      <div class="library-panel" id="panel-library" role="tabpanel" aria-labelledby="tab-library">
        <div class="library-toolbar">
          <div class="search-box">
            <span class="search-icon icon" aria-hidden="true">${sym.search}</span>
            <input type="search" class="search-input" placeholder="Search your PDFs" aria-label="Search your PDFs" enterkeyhint="search" />
          </div>
        </div>

        <div class="library-controls">
          <button type="button" class="sort-filter-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="sort-filter-sheet" hidden>
            <span class="icon" aria-hidden="true">${sym.sort}</span>
            <span class="sort-filter-btn-label">Sort &amp; filter</span>
            <span class="sort-filter-state" hidden></span>
          </button>
          <span class="library-count" aria-live="polite"></span>
        </div>

        <div class="content-scroll library-content">
          <div class="pdf-list" role="list" aria-label="Your PDFs"></div>
          <div class="empty-state hidden">
            <div class="empty-illustration" aria-hidden="true"></div>
            <p class="empty-message">Your shelf is empty</p>
            <p class="empty-hint"></p>
            <div class="empty-actions">
              <button type="button" class="btn btn-primary empty-add-btn" aria-haspopup="dialog" aria-controls="add-sheet">
                <span class="icon" aria-hidden="true">${sym.add}</span>
                <span class="btn-label">Add a PDF</span>
              </button>
              <button type="button" class="btn btn-secondary empty-find-btn">
                <span class="icon" aria-hidden="true">${sym.lookup}</span>
                <span class="btn-label">Find a free book</span>
              </button>
              <button type="button" class="btn btn-secondary empty-clear-btn hidden">
                <span class="icon" aria-hidden="true">${sym.refresh}</span>
                <span class="btn-label">Show everything</span>
              </button>
            </div>
          </div>
          <footer class="app-footer">
            <p class="privacy-note"><span class="icon" aria-hidden="true">${sym.sparkle}</span>Your PDFs stay on this device. Nothing is uploaded.</p>
            <p class="credit">
              Made by
              <a href="https://deac.online" target="_blank" rel="noopener" class="credit-link">deac.online</a>
              at
              <a href="https://worldbuild.io" target="_blank" rel="noopener" class="credit-link">worldbuild.io</a>
            </p>
          </footer>
        </div>
      </div>

      <div class="library-panel hidden" id="panel-find" role="tabpanel" aria-labelledby="tab-find" hidden></div>

      <button type="button" class="btn btn-primary add-fab" aria-label="Add a PDF" aria-haspopup="dialog" aria-expanded="false" aria-controls="add-sheet" data-toast-floor hidden>
        <span class="icon" aria-hidden="true">${sym.add}</span>
        <span class="btn-label">Add</span>
      </button>
    </div>

    <div class="tab-bar" role="tablist" aria-label="Library sections" data-toast-floor>
      <button type="button" class="tab-bar-tab" role="tab" id="tab-library" aria-controls="panel-library" aria-selected="true" tabindex="0">
        <span class="tab-bar-icon" aria-hidden="true"><span class="icon">${sym.document}</span></span>
        <span class="tab-bar-label">My Library</span>
      </button>
      <button type="button" class="tab-bar-tab" role="tab" id="tab-find" aria-controls="panel-find" aria-selected="false" tabindex="-1">
        <span class="tab-bar-icon" aria-hidden="true"><span class="icon">${sym.lookup}</span></span>
        <span class="tab-bar-label">Find Online</span>
      </button>
    </div>

    <input type="file" accept=".pdf,application/pdf" multiple class="file-input visually-hidden" id="library-file-input" tabindex="-1" aria-hidden="true" />
    <div class="toast hidden" role="status" aria-live="polite"></div>

    <div class="sheet hidden" id="add-sheet" role="dialog" aria-modal="true" aria-labelledby="add-sheet-title">
      <div class="sheet-panel">
        <h2 class="sheet-title" id="add-sheet-title">Add a PDF</h2>
        <div class="sheet-options">
          <button type="button" class="sheet-option add-from-files" aria-labelledby="add-files-label" aria-describedby="add-files-hint">
            <span class="sheet-option-icon" aria-hidden="true"><span class="icon">${sym.folder}</span></span>
            <span class="sheet-option-text">
              <span class="sheet-option-label" id="add-files-label">From Files</span>
              <span class="sheet-option-hint" id="add-files-hint">Pick PDFs saved on this device</span>
            </span>
          </button>
          <button type="button" class="sheet-option add-from-link" aria-labelledby="add-link-label" aria-describedby="add-link-hint">
            <span class="sheet-option-icon" aria-hidden="true"><span class="icon">${sym.link}</span></span>
            <span class="sheet-option-text">
              <span class="sheet-option-label" id="add-link-label">From a link</span>
              <span class="sheet-option-hint" id="add-link-hint">Paste a web link to a PDF</span>
            </span>
          </button>
        </div>
        <button type="button" class="btn btn-ghost sheet-close-btn">Cancel</button>
      </div>
    </div>

    <div class="sheet hidden" id="sort-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="sort-filter-title">
      <div class="sheet-panel">
        <h2 class="sheet-title" id="sort-filter-title">Sort &amp; filter</h2>
        <div class="sheet-group" role="radiogroup" aria-labelledby="sort-group-label" data-pref="sort">
          <p class="sheet-group-label" id="sort-group-label">Sort by</p>
          ${SORT_OPTIONS.map((o) => radioOption(o.value, o.label)).join('')}
        </div>
        <div class="sheet-group" role="radiogroup" aria-labelledby="filter-group-label" data-pref="filter">
          <p class="sheet-group-label" id="filter-group-label">Show</p>
          ${FILTER_OPTIONS.map((o) => radioOption(o.value, o.label)).join('')}
        </div>
        <button type="button" class="btn btn-primary sheet-close-btn">Done</button>
      </div>
    </div>

    <div class="download-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="download-dialog-title" aria-describedby="download-dialog-hint">
      <div class="download-dialog-panel">
        <div class="download-dialog-header">
          <h2 id="download-dialog-title" class="download-dialog-title">Add from a link</h2>
          <button type="button" class="btn-icon download-close-btn" aria-label="Close">
            <span class="icon" aria-hidden="true">${sym.close}</span>
          </button>
        </div>
        <p class="download-dialog-hint" id="download-dialog-hint">Paste a link that goes straight to a PDF (it usually ends in .pdf).</p>
        <label class="download-url-label">
          <span class="control-text">PDF link</span>
          <input type="url" class="download-url-input" placeholder="https://example.com/book.pdf" autocomplete="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" />
        </label>
        <p class="download-save-hint hidden"></p>
        <div class="download-dialog-actions">
          <button type="button" class="btn btn-ghost download-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-primary download-submit-btn">
            <span class="icon" aria-hidden="true">${sym.add}</span>
            <span class="btn-label">Add</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const tabLibrary = view.querySelector('#tab-library') as HTMLButtonElement;
  const tabFind = view.querySelector('#tab-find') as HTMLButtonElement;
  const panelLibrary = view.querySelector('#panel-library') as HTMLElement;
  const panelFind = view.querySelector('#panel-find') as HTMLElement;
  const libraryMain = view.querySelector('.library-main') as HTMLElement;
  const tabBar = view.querySelector('.tab-bar') as HTMLElement;
  const shellHeader = view.querySelector('.library-shell-header') as HTMLElement;
  const searchInput = view.querySelector('.search-input') as HTMLInputElement;
  const sortFilterBtn = view.querySelector('.sort-filter-btn') as HTMLButtonElement;
  const sortFilterState = view.querySelector('.sort-filter-state') as HTMLElement;
  const sortFilterSheet = view.querySelector('#sort-filter-sheet') as HTMLElement;
  const libraryCount = view.querySelector('.library-count') as HTMLElement;
  const fileInput = view.querySelector('.file-input') as HTMLInputElement;
  const addFab = view.querySelector('.add-fab') as HTMLButtonElement;
  const addSheet = view.querySelector('#add-sheet') as HTMLElement;
  const downloadDialog = view.querySelector('.download-dialog') as HTMLElement;
  const downloadUrlInput = view.querySelector('.download-url-input') as HTMLInputElement;
  const downloadSaveHint = view.querySelector('.download-save-hint') as HTMLElement;
  const downloadSubmitBtn = view.querySelector('.download-submit-btn') as HTMLButtonElement;
  const downloadCancelBtn = view.querySelector('.download-cancel-btn') as HTMLButtonElement;
  const downloadCloseBtn = view.querySelector('.download-close-btn') as HTMLButtonElement;
  const pdfList = view.querySelector('.pdf-list') as HTMLElement;
  const emptyState = view.querySelector('.empty-state') as HTMLElement;
  const emptyMessage = view.querySelector('.empty-message') as HTMLElement;
  const emptyHint = view.querySelector('.empty-hint') as HTMLElement;
  const emptyIllustration = view.querySelector('.empty-illustration') as HTMLElement;
  const emptyAddBtn = view.querySelector('.empty-add-btn') as HTMLButtonElement;
  const emptyFindBtn = view.querySelector('.empty-find-btn') as HTMLButtonElement;
  const emptyClearBtn = view.querySelector('.empty-clear-btn') as HTMLButtonElement;

  view.querySelectorAll('.credit-link').forEach((link) => {
    link.addEventListener('click', () => onCreditClick());
  });

  let prefs = loadPrefs();

  let pdfs: PdfMeta[] = [];
  let activeTab: LibraryTab = options?.initialTab ?? loadTab();

  const lookupPanel = createLookupPanel(
    {
      onPreview: callbacks.onPreview,
      onAdded: () => {
        void refresh();
      },
    },
    { loadingRoot: view },
  );
  panelFind.appendChild(lookupPanel);

  const toaster = createToaster(view.querySelector(':scope > .toast') as HTMLElement);
  const showToast = toaster.show;
  let tornDown = false;

  // ── Remove with Undo ──────────────────────────────────────
  // A removed PDF disappears at once; its stored copy is deleted only when
  // the Undo toast goes away (times out, is replaced, the view is swapped or
  // the app is backgrounded). If the app is killed in between, the PDF stays.
  const removalNames = new Map<string, string>();
  const undoToasts = new Map<string, ToastHandle>();
  const removals = createPendingRemovals({
    commit: removePdf,
    onCommitted: (id) => {
      removalNames.delete(id);
      undoToasts.get(id)?.dismiss();
      undoToasts.delete(id);
      // No re-render: the card was already hidden, and the next read won't find it.
    },
    onCommitError: (id, err) => {
      const name = removalNames.get(id);
      removalNames.delete(id);
      undoToasts.get(id)?.dismiss();
      undoToasts.delete(id);
      logger.logError('Failed to remove PDF', err);
      if (tornDown) return;
      void refresh();
      showToast(
        name ? `We couldn’t remove “${name}”, so it’s still on your shelf.` : friendlyError(err),
        { isError: true },
      );
    },
  });

  function offerUndo(id: string, name: string | undefined) {
    const handle = showToast(name ? `Removed “${name}”` : 'Removed it from your library', {
      duration: null, // the removal's own clock decides when it goes
      action: {
        label: 'Undo',
        accessibleLabel: name ? `Undo removing “${name}”` : 'Undo remove',
        onAction: () => void undoRemoval(id),
      },
      onPauseChange: (paused) => (paused ? removals.pause(id) : removals.resume(id)),
      onDismiss: (reason) => {
        undoToasts.delete(id);
        if (reason !== 'action') void removals.commit(id);
      },
    });
    undoToasts.set(id, handle);
  }

  async function removeWithUndo(pdf: PdfMeta) {
    // Where focus goes once the card is gone: the next card, else the previous.
    const ids = Array.from(pdfList.querySelectorAll<HTMLElement>('.pdf-card-info')).map((el) => el.dataset.id);
    const index = ids.indexOf(pdf.id);
    const nextFocusId = ids[index + 1] ?? ids[index - 1];

    removalNames.set(pdf.id, pdf.name);
    removals.remove(pdf.id);
    await applyQuery();
    if (tornDown) return;
    focusAfterRemoval(nextFocusId);
    offerUndo(pdf.id, pdf.name);
  }

  async function undoRemoval(id: string) {
    const name = removalNames.get(id);
    if (!removals.undo(id)) return;
    removalNames.delete(id);
    await applyQuery();
    if (tornDown) return;
    focusCard(id);
    showToast(name ? `“${name}” is back on your shelf` : 'It’s back on your shelf');
  }

  function focusCard(id: string): boolean {
    const target = Array.from(pdfList.querySelectorAll<HTMLElement>('.pdf-card-info')).find((el) => el.dataset.id === id);
    target?.focus();
    return Boolean(target);
  }

  function focusAfterRemoval(nextId: string | undefined) {
    if (nextId && focusCard(nextId)) return;
    if (!emptyState.classList.contains('hidden')) {
      const action = Array.from(emptyState.querySelectorAll<HTMLElement>('.empty-actions .btn')).find(
        (el) => !el.classList.contains('hidden'),
      );
      if (action) {
        action.focus();
        return;
      }
    }
    searchInput.focus();
  }

  function commitRemovalsNow() {
    // Dismissing an Undo toast commits its removal; flush catches the rest.
    undoToasts.forEach((handle) => handle.dismiss());
    void removals.flush();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') commitRemovalsNow();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', commitRemovalsNow);

  // ── Card "More" menus ─────────────────────────────────────
  let menuSeq = 0;
  let openMenu: { card: HTMLElement; button: HTMLButtonElement; menu: HTMLElement } | null = null;

  function menuItems(menu: HTMLElement): HTMLButtonElement[] {
    return Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  }

  function closeMenu(returnFocus = false) {
    if (!openMenu) return;
    const { card, button, menu } = openMenu;
    openMenu = null;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    card.classList.remove('pdf-card--menu-open');
    if (returnFocus) button.focus();
  }

  function openCardMenu(card: HTMLElement, button: HTMLButtonElement, menu: HTMLElement, focus: 'first' | 'last') {
    closeMenu();
    openMenu = { card, button, menu };
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    card.classList.add('pdf-card--menu-open');
    const items = menuItems(menu);
    items[focus === 'first' ? 0 : items.length - 1]?.focus();
  }

  function setupCardMenu(card: HTMLElement, pdf: PdfMeta) {
    const button = card.querySelector('.pdf-more-btn') as HTMLButtonElement;
    const menu = card.querySelector('.pdf-card-menu') as HTMLElement;

    button.addEventListener('click', () => {
      if (openMenu?.menu === menu) closeMenu();
      else openCardMenu(card, button, menu, 'first');
    });
    button.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openCardMenu(card, button, menu, e.key === 'ArrowDown' ? 'first' : 'last');
      } else if (e.key === 'Escape' && openMenu?.menu === menu) {
        e.preventDefault();
        closeMenu(true);
      }
    });

    menu.addEventListener('keydown', (e) => {
      const items = menuItems(menu);
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      let next = -1;
      if (e.key === 'ArrowDown') next = (index + 1) % items.length;
      else if (e.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = items.length - 1;
      else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu(true);
        return;
      } else if (e.key === 'Tab') {
        closeMenu();
        return;
      }
      if (next >= 0) {
        e.preventDefault();
        items[next].focus();
      }
    });
    menu.addEventListener('focusout', (e) => {
      const to = e.relatedTarget as Node | null;
      if (openMenu?.menu === menu && to && !menu.contains(to) && to !== button) closeMenu();
    });

    card.querySelector('.rename-btn')?.addEventListener('click', () => {
      closeMenu();
      startRename(card, pdf);
    });
    card.querySelector('.remove-btn')?.addEventListener('click', () => {
      closeMenu();
      void removeWithUndo(pdf);
    });
  }

  function onDocumentPointerDown(e: PointerEvent) {
    if (!openMenu) return;
    const target = e.target as Node;
    if (!openMenu.menu.contains(target) && !openMenu.button.contains(target)) closeMenu();
  }
  document.addEventListener('pointerdown', onDocumentPointerDown);

  view.addEventListener('remove', () => {
    // The view is being swapped out: settle any removal still offering Undo.
    commitRemovalsNow();
    tornDown = true;
    closeMenu();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', commitRemovalsNow);
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    fabObserver?.disconnect();
  });

  function setTab(tab: LibraryTab, focusSearch = false) {
    activeTab = tab;
    saveTab(tab);

    const isLibrary = tab === 'library';
    tabLibrary.setAttribute('aria-selected', String(isLibrary));
    tabFind.setAttribute('aria-selected', String(!isLibrary));
    tabLibrary.tabIndex = isLibrary ? 0 : -1;
    tabFind.tabIndex = isLibrary ? -1 : 0;

    panelLibrary.classList.toggle('hidden', !isLibrary);
    panelFind.classList.toggle('hidden', isLibrary);
    panelFind.hidden = isLibrary;
    panelLibrary.hidden = !isLibrary;
    syncFab();

    // Only jump into the search field with a keyboard/mouse; on touch it would
    // pop the on-screen keyboard over the welcome state.
    const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (!isLibrary && focusSearch && !coarsePointer) {
      lookupPanel.querySelector<HTMLInputElement>('.lookup-query-input')?.focus();
    }
  }

  function handleTabKeydown(e: KeyboardEvent, tabs: HTMLButtonElement[], index: number) {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    const nextTab = tabs[nextIndex];
    setTab(nextTab.id === 'tab-find' ? 'find' : 'library');
    nextTab.focus();
  }

  const tabs = [tabLibrary, tabFind];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      setTab(tab.id === 'tab-find' ? 'find' : 'library', true);
    });
    tab.addEventListener('keydown', (e) => handleTabKeydown(e, tabs, index));
  });

  let dialogReturnFocus: HTMLElement | null = null;
  // Everything behind a dialog or sheet: made inert while one is open.
  const backgroundEls = [shellHeader, libraryMain, tabBar];

  // ── Bottom sheets (Add, Sort & filter) ────────────────────
  // Modal like the link dialog: the page behind is inert, Escape or a tap on
  // the backdrop closes, and focus goes back to whatever opened it.
  type Sheet = { open: (opener: HTMLElement | null, focusEl?: HTMLElement | null) => void; close: (restoreFocus?: boolean) => void };

  function createSheet(sheet: HTMLElement, onClose?: () => void): Sheet {
    let returnFocus: HTMLElement | null = null;
    let opener: HTMLElement | null = null;

    function open(from: HTMLElement | null, focusEl?: HTMLElement | null) {
      closeMenu();
      opener = from;
      returnFocus = from ?? (document.activeElement as HTMLElement | null);
      opener?.setAttribute('aria-expanded', 'true');
      sheet.classList.remove('hidden');
      backgroundEls.forEach((el) => el.setAttribute('inert', ''));
      (focusEl ?? sheet.querySelector<HTMLElement>('button'))?.focus();
    }

    function close(restoreFocus = true) {
      if (sheet.classList.contains('hidden')) return;
      sheet.classList.add('hidden');
      backgroundEls.forEach((el) => el.removeAttribute('inert'));
      opener?.setAttribute('aria-expanded', 'false');
      if (restoreFocus) returnFocus?.focus?.();
      returnFocus = null;
      opener = null;
      onClose?.();
    }

    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) close();
    });
    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });
    sheet.querySelectorAll('.sheet-close-btn').forEach((btn) => btn.addEventListener('click', () => close()));
    return { open, close };
  }

  const addSheetCtl = createSheet(addSheet);
  const sortFilterSheetCtl = createSheet(sortFilterSheet);

  function openAddSheet(opener: HTMLElement) {
    addSheetCtl.open(opener);
  }

  addFab.addEventListener('click', () => openAddSheet(addFab));
  emptyAddBtn.addEventListener('click', () => openAddSheet(emptyAddBtn));
  (addSheet.querySelector('.add-from-files') as HTMLButtonElement).addEventListener('click', () => {
    addSheetCtl.close();
    // Still inside the tap, so iOS lets the file picker open.
    fileInput.click();
  });
  (addSheet.querySelector('.add-from-link') as HTMLButtonElement).addEventListener('click', () => {
    addSheetCtl.close();
    openDownloadDialog();
  });

  // ── Sort & filter ─────────────────────────────────────────
  const radioGroups = Array.from(sortFilterSheet.querySelectorAll<HTMLElement>('[role="radiogroup"]'));

  function radiosOf(group: HTMLElement): HTMLButtonElement[] {
    return Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  }

  function syncSortFilter() {
    radioGroups.forEach((group) => {
      const current = group.dataset.pref === 'sort' ? prefs.sort : prefs.filter;
      radiosOf(group).forEach((radio) => {
        const on = radio.dataset.value === current;
        radio.setAttribute('aria-checked', String(on));
        radio.tabIndex = on ? 0 : -1;
      });
    });
    const filterLabel = FILTER_OPTIONS.find((o) => o.value === prefs.filter)?.label ?? '';
    const filtered = prefs.filter !== DEFAULT_LIBRARY_PREFS.filter;
    sortFilterState.hidden = !filtered;
    sortFilterState.textContent = filtered ? filterLabel : '';
  }

  function choose(group: HTMLElement, radio: HTMLButtonElement) {
    const value = radio.dataset.value;
    if (group.dataset.pref === 'sort' && isLibrarySort(value)) prefs = { ...prefs, sort: value };
    else if (group.dataset.pref === 'filter' && isLibraryFilter(value)) prefs = { ...prefs, filter: value };
    else return;
    savePrefs(prefs);
    syncSortFilter();
    void applyQuery();
  }

  radioGroups.forEach((group) => {
    const radios = radiosOf(group);
    radios.forEach((radio, index) => {
      radio.addEventListener('click', () => choose(group, radio));
      radio.addEventListener('keydown', (e) => {
        let next = -1;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % radios.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (index - 1 + radios.length) % radios.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = radios.length - 1;
        if (next < 0) return;
        e.preventDefault();
        choose(group, radios[next]);
        radios[next].focus();
      });
    });
  });

  sortFilterBtn.addEventListener('click', () => {
    const checked = sortFilterSheet.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
    sortFilterSheetCtl.open(sortFilterBtn, checked);
  });

  // ── Add button ────────────────────────────────────────────
  // Floats above the tab bar on My Library once there's a book (an empty shelf
  // has its own "Add a PDF"). The list gets matching room at the end so the
  // last card and the footer can scroll clear of it.
  let shelfCount = 0;

  function syncFab() {
    const show = activeTab === 'library' && shelfCount > 0;
    addFab.hidden = !show;
    panelLibrary.classList.toggle('library-panel--with-fab', show);
    if (!show) addSheetCtl.close(false);
  }

  const fabObserver =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          if (addFab.offsetHeight > 0) view.style.setProperty('--fab-h', `${addFab.offsetHeight}px`);
        })
      : null;
  fabObserver?.observe(addFab);

  setTab(activeTab);

  function openDownloadDialog() {
    dialogReturnFocus = document.activeElement as HTMLElement | null;
    downloadUrlInput.value = '';
    downloadSaveHint.classList.add('hidden');
    if (supportsSaveFilePicker()) {
      downloadSaveHint.textContent = 'You’ll pick where to save a copy first, then it joins your library.';
      downloadSaveHint.classList.remove('hidden');
    }
    downloadDialog.classList.remove('hidden');
    backgroundEls.forEach((el) => el.setAttribute('inert', ''));
    downloadUrlInput.focus();
  }

  function closeDownloadDialog() {
    downloadDialog.classList.add('hidden');
    backgroundEls.forEach((el) => el.removeAttribute('inert'));
    dialogReturnFocus?.focus?.();
    dialogReturnFocus = null;
  }

  async function submitDownload() {
    const url = downloadUrlInput.value.trim();
    if (!url) {
      showToast('Paste a PDF link first.', { isError: true });
      downloadUrlInput.focus();
      return;
    }

    closeDownloadDialog();
    const hideLoading = showLoading(view, 'Adding to your library…');
    try {
      const { meta, savedToDisk } = await downloadAndAddPdf(url);
      await refresh();
      if (savedToDisk) {
        showToast(`Saved a copy and added “${meta.name}” to your library`);
      } else {
        showToast(`Added “${meta.name}” to your library`);
      }
    } catch (err) {
      const cancelled = errorDetailOf(err) === 'Save cancelled';
      showToast(friendlyError(err), { isError: !cancelled });
      logger.logError('Failed to download PDF', err);
    } finally {
      hideLoading();
    }
  }

  function renderList(items: PdfMeta[], animate = false) {
    closeMenu();
    pdfList.innerHTML = '';
    // PDFs waiting out their Undo window are gone as far as people can tell.
    shelfCount = removals.visible(pdfs).length;
    pdfList.classList.toggle('pdf-list--animate', animate);
    sortFilterBtn.hidden = !showsSortFilter(shelfCount);
    if (sortFilterBtn.hidden) sortFilterSheetCtl.close(false);
    syncSortFilter();
    syncFab();

    const hasQuery = searchInput.value.trim().length > 0;
    const hasFilter = prefs.filter !== DEFAULT_LIBRARY_PREFS.filter;

    if (items.length === 0) {
      emptyState.classList.remove('hidden');
      pdfList.classList.add('hidden');
      libraryCount.textContent = '';

      const libraryEmpty = shelfCount === 0;
      panelLibrary.classList.toggle('library-panel--empty', libraryEmpty);
      emptyIllustration.innerHTML = pageBuddy(libraryEmpty ? 'happy' : 'curious', 128);
      emptyAddBtn.classList.toggle('hidden', !libraryEmpty);
      emptyFindBtn.classList.toggle('hidden', !libraryEmpty);
      emptyClearBtn.classList.toggle('hidden', libraryEmpty);
      if (libraryEmpty) {
        emptyMessage.textContent = 'Your shelf is empty';
        emptyHint.textContent = 'Add a PDF from Files or a link, or find a free classic online.';
      } else if (hasQuery && !hasFilter) {
        emptyMessage.textContent = 'No titles match that';
        emptyHint.textContent = 'Check the spelling, or try a shorter word.';
      } else {
        emptyMessage.textContent = 'Nothing here right now';
        emptyHint.textContent = 'No PDFs match your search and filter.';
      }
      emptyHint.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    pdfList.classList.remove('hidden');
    panelLibrary.classList.remove('library-panel--empty');

    const countLabel =
      hasQuery || hasFilter ? `${items.length} of ${shelfCount}` : `${items.length}`;
    libraryCount.textContent = `${countLabel} PDF${shelfCount === 1 ? '' : 's'}`;

    items.forEach((pdf, index) => {
      const card = document.createElement('div');
      const unread = pdf.lastOpened === 0;
      const finished = pdf.totalPages > 0 && pdf.currentPage >= pdf.totalPages;
      const percent = pdf.totalPages > 0 ? Math.round((pdf.currentPage / pdf.totalPages) * 100) : 0;
      const name = escapeHtml(pdf.name);
      const menuId = ++menuSeq;
      let status = '';
      if (unread) {
        status = `<span class="pdf-badge pdf-badge-new">New</span>`;
      } else if (finished) {
        status = `<span class="pdf-badge pdf-badge-done"><span class="icon" aria-hidden="true">${sym.check}</span>Finished</span>`;
      } else if (pdf.totalPages > 0) {
        status = `<span class="pdf-progress-text">Page ${pdf.currentPage} of ${pdf.totalPages}</span>`;
      }

      card.className = `pdf-card${unread ? ' pdf-card-unread' : ''}`;
      card.setAttribute('role', 'listitem');
      card.style.setProperty('--stagger', String(Math.min(index, 8)));
      card.innerHTML = `
        <div class="pdf-card-info" data-id="${pdf.id}" role="button" tabindex="0">
          <span class="pdf-card-icon" aria-hidden="true">${sym.document}</span>
          <span class="visually-hidden">Open</span>
          <div class="pdf-card-text">
            <span class="pdf-name">${name}</span>
            <span class="pdf-meta">${status}<span class="pdf-size">${formatBytes(pdf.size)}</span></span>
            ${!unread && pdf.totalPages > 0 && !finished ? `<span class="pdf-progress" aria-hidden="true"><span class="pdf-progress-fill" style="width:${percent}%"></span></span>` : ''}
          </div>
        </div>
        <div class="pdf-card-actions">
          <button type="button" class="btn-icon pdf-more-btn" id="pdf-more-${menuId}" aria-haspopup="menu" aria-expanded="false" aria-controls="pdf-menu-${menuId}" aria-label="More options for ${name}">
            <span class="icon" aria-hidden="true">${sym.more}</span>
          </button>
          <div class="pdf-card-menu" id="pdf-menu-${menuId}" role="menu" aria-labelledby="pdf-more-${menuId}" hidden>
            <button type="button" class="pdf-card-menu-item rename-btn" role="menuitem" tabindex="-1">
              <span class="icon" aria-hidden="true">${sym.edit}</span><span>Rename</span>
            </button>
            <button type="button" class="pdf-card-menu-item pdf-card-menu-item-danger remove-btn" role="menuitem" tabindex="-1">
              <span class="icon" aria-hidden="true">${sym.remove}</span><span>Remove</span>
            </button>
          </div>
        </div>
      `;

      const info = card.querySelector('.pdf-card-info') as HTMLElement;
      info.addEventListener('click', () => {
        if (card.querySelector('.pdf-name-input')) return;
        callbacks.onOpenPdf(pdf.id);
      });
      info.addEventListener('keydown', (e) => {
        if (e.target !== info) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          callbacks.onOpenPdf(pdf.id);
        }
      });

      setupCardMenu(card, pdf);

      pdfList.appendChild(card);
    });
  }

  function startRename(card: HTMLElement, pdf: PdfMeta) {
    const nameEl = card.querySelector('.pdf-name') as HTMLElement | null;
    const info = card.querySelector('.pdf-card-info') as HTMLElement | null;
    if (!nameEl || !info || card.querySelector('.pdf-name-input')) return;
    // A text field can't live inside role=button: drop the role while editing.
    info.removeAttribute('role');
    info.removeAttribute('tabindex');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pdf-name-input';
    input.value = pdf.name;
    input.setAttribute('aria-label', `Rename ${pdf.name}`);
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;

    async function finish(save: boolean, fromKeyboard = false) {
      if (finished) return;
      finished = true;

      const span = document.createElement('span');
      span.className = 'pdf-name';

      if (save) {
        const nextName = input.value.trim();
        if (!nextName) {
          span.textContent = pdf.name;
          showToast('Give it a name first.', { isError: true });
        } else if (nextName !== pdf.name) {
          try {
            await renamePdf(pdf.id, nextName);
            span.textContent = nextName;
            showToast('Renamed');
            await refresh();
            if (fromKeyboard) focusCard(pdf.id);
            return;
          } catch (err) {
            span.textContent = pdf.name;
            showToast(friendlyError(err), { isError: true });
            logger.logError('Failed to rename PDF', err);
          }
        } else {
          span.textContent = pdf.name;
        }
      } else {
        span.textContent = pdf.name;
      }

      input.replaceWith(span);
      info?.setAttribute('role', 'button');
      info?.setAttribute('tabindex', '0');
      if (fromKeyboard) info?.focus();
    }

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        void finish(true, true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        void finish(false, true);
      }
    });

    input.addEventListener('click', (e) => e.stopPropagation());

    input.addEventListener('blur', () => {
      void finish(true);
    });
  }

  // Reads can finish out of order (typing, a removal committing): only the
  // latest one renders, so a stale read can't bring back a removed card.
  let renderSeq = 0;

  async function applyQuery(animate = false) {
    const seq = ++renderSeq;
    const all = await getAllPdfs();
    if (seq !== renderSeq || tornDown) return;

    // With six or fewer books "Sort & filter" is hidden, so go back to the
    // defaults: a filter picked earlier mustn't quietly hide books.
    const effective = effectiveLibraryPrefs(prefs, removals.visible(all).length);
    if (!isDefaultLibraryPrefs(prefs) && isDefaultLibraryPrefs(effective)) {
      prefs = effective;
      savePrefs(prefs);
    }

    const items = await queryPdfs({
      query: searchInput.value,
      filter: prefs.filter,
      sort: prefs.sort,
    });
    if (seq !== renderSeq || tornDown) return;
    pdfs = all;
    renderList(removals.visible(items), animate);
  }

  async function refresh(animate = false) {
    await applyQuery(animate);
  }

  searchInput.addEventListener('input', () => applyQuery());

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files?.length) return;
    const hideLoading = showLoading(view, 'Adding to your library…');
    try {
      const added = await addPdfFiles(fileInput.files);
      await refresh();
      if (added.length === 0) {
        showToast('That wasn’t a PDF. Pick a file that ends in .pdf.', { isError: true });
      } else {
        showToast(
          added.length === 1
            ? `Added “${added[0].name}” to your library`
            : `Added ${added.length} PDFs to your library`,
        );
      }
    } catch (err) {
      showToast(friendlyError(err), { isError: true });
      logger.logError('Failed to add PDFs', err);
    } finally {
      hideLoading();
      fileInput.value = '';
    }
  });

  downloadCancelBtn.addEventListener('click', () => closeDownloadDialog());
  downloadCloseBtn.addEventListener('click', () => closeDownloadDialog());
  downloadSubmitBtn.addEventListener('click', () => void submitDownload());
  downloadUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submitDownload();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDownloadDialog();
    }
  });
  downloadDialog.addEventListener('click', (e) => {
    if (e.target === downloadDialog) closeDownloadDialog();
  });
  downloadDialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDownloadDialog();
    }
  });

  emptyFindBtn.addEventListener('click', () => setTab('find', true));
  emptyClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    prefs = { ...prefs, filter: DEFAULT_LIBRARY_PREFS.filter };
    savePrefs(prefs);
    void applyQuery();
  });

  const removeOnOpen = options?.removePdfId;
  if (removeOnOpen) removals.remove(removeOnOpen);
  void refresh(true).then(() => {
    if (!removeOnOpen || tornDown) return;
    const meta = pdfs.find((p) => p.id === removeOnOpen);
    if (meta) {
      removalNames.set(meta.id, meta.name);
      offerUndo(meta.id, meta.name);
    } else {
      // Already gone from storage: nothing to undo.
      void removals.commit(removeOnOpen);
      showToast('Removed it from your library');
    }
  });
  if (options?.toast) showToast(options.toast);
  return view;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

