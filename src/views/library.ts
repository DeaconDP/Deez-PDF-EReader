import {
  addPdfFiles,
  downloadAndAddPdf,
  getAllPdfs,
  queryPdfs,
  removePdf,
  renamePdf,
  supportsSaveFilePicker,
  type PdfFilter,
  type PdfMeta,
  type PdfSort,
} from '../lib/library';
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

type LibraryPrefs = {
  filter: PdfFilter;
  sort: PdfSort;
};

function loadPrefs(): LibraryPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as LibraryPrefs;
  } catch {
    /* ignore */
  }
  return { filter: 'all', sort: 'lastOpened-desc' };
}

function savePrefs(prefs: LibraryPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
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
      <div class="segmented-control" role="tablist" aria-label="Library sections">
        <button type="button" class="segmented-control-btn" role="tab" id="tab-library" aria-controls="panel-library" aria-selected="true" tabindex="0">
          <span class="icon" aria-hidden="true">${sym.document}</span><span>My Library</span>
        </button>
        <button type="button" class="segmented-control-btn" role="tab" id="tab-find" aria-controls="panel-find" aria-selected="false" tabindex="-1">
          <span class="icon" aria-hidden="true">${sym.lookup}</span><span>Find Online</span>
        </button>
      </div>
    </header>

    <div class="library-panel" id="panel-library" role="tabpanel" aria-labelledby="tab-library">
      <div class="library-toolbar">
        <div class="library-toolbar-actions">
          <label class="btn btn-primary add-pdf-btn">
            <span class="icon" aria-hidden="true">${sym.add}</span>
            <span class="btn-label">Add PDF</span>
            <input type="file" accept=".pdf,application/pdf" multiple class="file-input visually-hidden" id="library-file-input" aria-label="Add PDF" />
          </label>
          <button type="button" class="btn btn-secondary download-btn download-btn-inline">
            <span class="icon" aria-hidden="true">${sym.link}</span>
            <span class="btn-label">From a link</span>
          </button>
        </div>
        <div class="search-box">
          <span class="search-icon icon" aria-hidden="true">${sym.search}</span>
          <input type="search" class="search-input" placeholder="Search your PDFs" aria-label="Search your PDFs" enterkeyhint="search" />
        </div>
      </div>

      <div class="library-controls">
        <label class="control-label">
          <span class="control-glyph icon" aria-hidden="true">${sym.filter}</span>
          <span class="visually-hidden">Show</span>
          <select class="filter-select" aria-label="Show">
            <option value="all">All PDFs</option>
            <option value="unread">Not started</option>
            <option value="reading">Reading</option>
            <option value="finished">Finished</option>
          </select>
          <span class="control-chevron icon" aria-hidden="true">${sym.chevronDown}</span>
        </label>
        <label class="control-label">
          <span class="control-glyph icon" aria-hidden="true">${sym.sort}</span>
          <span class="visually-hidden">Sort by</span>
          <select class="sort-select" aria-label="Sort by">
            <option value="lastOpened-desc">Recently opened</option>
            <option value="dateAdded-desc">Newest added</option>
            <option value="dateAdded-asc">Oldest added</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="size-desc">Largest</option>
            <option value="size-asc">Smallest</option>
          </select>
          <span class="control-chevron icon" aria-hidden="true">${sym.chevronDown}</span>
        </label>
        <span class="library-count" aria-live="polite"></span>
      </div>

      <div class="content-scroll library-content">
        <div class="pdf-list" role="list" aria-label="Your PDFs"></div>
        <div class="empty-state hidden">
          <div class="empty-illustration" aria-hidden="true"></div>
          <p class="empty-message">Your shelf is empty</p>
          <p class="empty-hint">Add a PDF from your phone, or find a free classic online.</p>
          <div class="empty-actions">
            <label for="library-file-input" class="btn btn-primary empty-add-btn" role="button" tabindex="0">
              <span class="icon" aria-hidden="true">${sym.add}</span>
              <span class="btn-label">Add a PDF</span>
            </label>
            <button type="button" class="btn btn-secondary empty-find-btn">
              <span class="icon" aria-hidden="true">${sym.lookup}</span>
              <span class="btn-label">Find a free book</span>
            </button>
            <button type="button" class="btn btn-ghost empty-link-btn">
              <span class="icon" aria-hidden="true">${sym.link}</span>
              <span class="btn-label">Paste a link</span>
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

    <div class="toast hidden" role="status" aria-live="polite"></div>
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
            <span class="btn-label">Add PDF</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const tabLibrary = view.querySelector('#tab-library') as HTMLButtonElement;
  const tabFind = view.querySelector('#tab-find') as HTMLButtonElement;
  const panelLibrary = view.querySelector('#panel-library') as HTMLElement;
  const panelFind = view.querySelector('#panel-find') as HTMLElement;
  const searchInput = view.querySelector('.search-input') as HTMLInputElement;
  const filterSelect = view.querySelector('.filter-select') as HTMLSelectElement;
  const sortSelect = view.querySelector('.sort-select') as HTMLSelectElement;
  const libraryCount = view.querySelector('.library-count') as HTMLElement;
  const fileInput = view.querySelector('.file-input') as HTMLInputElement;
  const downloadBtn = view.querySelector('.download-btn-inline') as HTMLButtonElement;
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
  const emptyAddBtn = view.querySelector('.empty-add-btn') as HTMLElement;
  const emptyFindBtn = view.querySelector('.empty-find-btn') as HTMLButtonElement;
  const emptyClearBtn = view.querySelector('.empty-clear-btn') as HTMLButtonElement;
  const emptyLinkBtn = view.querySelector('.empty-link-btn') as HTMLButtonElement;

  view.querySelectorAll('.credit-link').forEach((link) => {
    link.addEventListener('click', () => onCreditClick());
  });

  const prefs = loadPrefs();
  filterSelect.value = prefs.filter;
  sortSelect.value = prefs.sort;

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

  setTab(activeTab);

  let dialogReturnFocus: HTMLElement | null = null;
  const backgroundEls = [view.querySelector('.library-shell-header') as HTMLElement, panelLibrary, panelFind];

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
    const hideLoading = showLoading(view, 'Fetching your PDF…');
    try {
      const { meta, savedToDisk } = await downloadAndAddPdf(url);
      await refresh();
      if (savedToDisk) {
        showToast(`Saved and added “${meta.name}”`);
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
    const shelfCount = removals.visible(pdfs).length;
    pdfList.classList.toggle('pdf-list--animate', animate);

    const hasQuery = searchInput.value.trim().length > 0;
    const hasFilter = filterSelect.value !== 'all';

    if (items.length === 0) {
      emptyState.classList.remove('hidden');
      pdfList.classList.add('hidden');
      libraryCount.textContent = '';

      const libraryEmpty = shelfCount === 0;
      panelLibrary.classList.toggle('library-panel--empty', libraryEmpty);
      emptyIllustration.innerHTML = pageBuddy(libraryEmpty ? 'happy' : 'curious', 128);
      emptyAddBtn.classList.toggle('hidden', !libraryEmpty);
      emptyFindBtn.classList.toggle('hidden', !libraryEmpty);
      emptyLinkBtn.classList.toggle('hidden', !libraryEmpty);
      emptyClearBtn.classList.toggle('hidden', libraryEmpty);
      if (libraryEmpty) {
        emptyMessage.textContent = 'Your shelf is empty';
        emptyHint.textContent = 'Add a PDF from your phone, or find a free classic online.';
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
    const filter = filterSelect.value as PdfFilter;
    const sort = sortSelect.value as PdfSort;
    savePrefs({ filter, sort });

    const seq = ++renderSeq;
    const [all, items] = await Promise.all([
      getAllPdfs(),
      queryPdfs({
        query: searchInput.value,
        filter,
        sort,
      }),
    ]);
    if (seq !== renderSeq || tornDown) return;
    pdfs = all;
    renderList(removals.visible(items), animate);
  }

  async function refresh(animate = false) {
    await applyQuery(animate);
  }

  searchInput.addEventListener('input', () => applyQuery());
  filterSelect.addEventListener('change', () => applyQuery());
  sortSelect.addEventListener('change', () => applyQuery());

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files?.length) return;
    const hideLoading = showLoading(view, 'Adding to your shelf…');
    try {
      const added = await addPdfFiles(fileInput.files);
      await refresh();
      if (added.length === 0) {
        showToast('That wasn’t a PDF. Pick a file that ends in .pdf.', { isError: true });
      } else {
        showToast(added.length === 1 ? `Added “${added[0].name}”` : `Added ${added.length} PDFs`);
      }
    } catch (err) {
      showToast(friendlyError(err), { isError: true });
      logger.logError('Failed to add PDFs', err);
    } finally {
      hideLoading();
      fileInput.value = '';
    }
  });

  downloadBtn.addEventListener('click', () => openDownloadDialog());

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
  emptyLinkBtn.addEventListener('click', () => openDownloadDialog());
  emptyAddBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  emptyClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterSelect.value = 'all';
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

