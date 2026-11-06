import { addLookupResultToLibrary } from '../lib/library';
import { fetchPdfFromUrl } from '../lib/download';
import { AppError, ErrorCodes, errorCodeOf, errorDetailOf, escapeHtml, friendlyError } from '../lib/errors';
import { pageBuddy } from '../components/illustration';
import { searchLookupPdfs, type LookupResult, type LookupSource } from '../lib/lookup/search';
import { cachePreviewBlob } from '../lib/lookup/preview-cache';
import { logger } from '../lib/logger';
import { showLoading } from '../components/loading';
import { sym } from '../lib/symbols';
import { createToaster } from '../components/toast';
import { WEB_SEARCH_ENABLED, enabledSources, usableSourceFilter, type SourceFilter } from '../lib/lookup/sources';
import type { PdfMeta } from '../lib/library';

export type LookupPanelCallbacks = {
  onPreview: (result: LookupResult, blob: Blob) => void;
  onAdded: (meta: PdfMeta) => void;
};

export type LookupPanelOptions = {
  loadingRoot: HTMLElement;
};

const SOURCE_LABELS: Record<LookupSource, string> = {
  archive: 'Internet Archive',
  gutenberg: 'Gutenberg',
  web: 'Web',
};

export function createLookupPanel(
  callbacks: LookupPanelCallbacks,
  options: LookupPanelOptions,
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'lookup-panel';

  panel.innerHTML = `
    <form class="lookup-search-bar" role="search">
      <div class="search-box">
        <span class="search-icon icon" aria-hidden="true">${sym.search}</span>
        <input type="search" class="lookup-query-input" placeholder="Title, author or topic" aria-label="Search free books and PDFs" enterkeyhint="search" />
      </div>
      <button type="submit" class="btn btn-primary lookup-search-btn">
        <span class="btn-label">Search</span>
      </button>
    </form>

    <div class="lookup-filters" role="group" aria-label="Where to look">
      <button type="button" class="lookup-filter-chip active" data-filter="all" aria-pressed="true">Everywhere</button>
      ${enabledSources()
        .map((source) => `<button type="button" class="lookup-filter-chip" data-filter="${source}" aria-pressed="false">${SOURCE_LABELS[source]}</button>`)
        .join('')}
    </div>
    <p class="lookup-disclaimer">Free and public-domain sources. Preview anything first; only add what you’re allowed to use.</p>
    <p class="lookup-notice hidden" role="status"></p>

    <div class="content-scroll lookup-content">
      <div class="lookup-results pdf-list hidden" role="list" aria-label="Search results"></div>

      <div class="lookup-empty empty-state hidden">
        <div class="empty-illustration" aria-hidden="true">${pageBuddy('reading', 128)}</div>
        <p class="empty-message">What do you feel like reading?</p>
        <p class="empty-hint">Search thousands of free classics, papers and public-domain books.</p>
      </div>

      <div class="lookup-no-results empty-state hidden">
        <div class="empty-illustration" aria-hidden="true">${pageBuddy('curious', 128)}</div>
        <p class="empty-message">No PDFs found</p>
        <p class="empty-hint">Try fewer words, or an author’s surname.</p>
        <button type="button" class="btn btn-secondary lookup-retry-btn">
          <span class="btn-label">Try another search</span>
        </button>
      </div>
    </div>

    <div class="toast hidden" role="status" aria-live="polite"></div>
  `;

  const queryInput = panel.querySelector('.lookup-query-input') as HTMLInputElement;
  const searchForm = panel.querySelector('.lookup-search-bar') as HTMLFormElement;
  const filterChips = panel.querySelectorAll('.lookup-filter-chip') as NodeListOf<HTMLButtonElement>;
  const resultsList = panel.querySelector('.lookup-results') as HTMLElement;
  const emptyState = panel.querySelector('.lookup-empty') as HTMLElement;
  const noResultsState = panel.querySelector('.lookup-no-results') as HTMLElement;
  const retryBtn = panel.querySelector('.lookup-retry-btn') as HTMLButtonElement;
  const retryLabel = retryBtn.querySelector('.btn-label') as HTMLElement;
  const noResultsMessage = panel.querySelector('.lookup-no-results .empty-message') as HTMLElement;
  const noResultsHint = panel.querySelector('.lookup-no-results .empty-hint') as HTMLElement;
  function chipLabel(filter: SourceFilter): string {
    return filter === 'all' ? 'any source' : SOURCE_LABELS[filter];
  }
  const noticeEl = panel.querySelector('.lookup-notice') as HTMLElement;
  const toast = panel.querySelector('.toast') as HTMLElement;
  const loadingRoot = options.loadingRoot;

  // Restored from the last search so coming back from a preview keeps the results.
  let allResults: LookupResult[] = savedSearch.results;
  let sourceFilter: SourceFilter = usableSourceFilter(savedSearch.filter);
  const addedIds = savedSearch.addedIds;
  let lastQuery = savedSearch.query;
  let lastNotice = WEB_SEARCH_ENABLED ? savedSearch.notice : '';

  function remember() {
    savedSearch = { query: lastQuery, results: allResults, filter: sourceFilter, addedIds, notice: lastNotice };
  }

  const { show: showToast } = createToaster(toast);

  function syncChips() {
    filterChips.forEach((chip) => {
      const on = chip.dataset.filter === sourceFilter;
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
  }

  function setFilter(next: SourceFilter) {
    sourceFilter = usableSourceFilter(next);
    syncChips();
    remember();
    renderResults();
  }

  function filteredResults(): LookupResult[] {
    if (sourceFilter === 'all') return allResults;
    return allResults.filter((result) => result.source === sourceFilter);
  }

  function updateVisibility(hasSearched: boolean, items: LookupResult[]) {
    noticeEl.textContent = lastNotice;
    noticeEl.classList.toggle('hidden', !lastNotice);
    emptyState.classList.add('hidden');
    noResultsState.classList.add('hidden');
    resultsList.classList.add('hidden');

    if (!hasSearched) {
      emptyState.classList.remove('hidden');
      return;
    }

    if (items.length === 0) {
      const hiddenByFilter = allResults.length > 0;
      noResultsMessage.textContent = hiddenByFilter ? `Nothing from ${chipLabel(sourceFilter)}` : 'No PDFs found';
      noResultsHint.textContent = hiddenByFilter
        ? `${allResults.length} result${allResults.length === 1 ? '' : 's'} came from other sources.`
        : 'Try fewer words, or an author’s surname.';
      retryLabel.textContent = hiddenByFilter ? 'Show all sources' : 'Try another search';
      noResultsState.classList.remove('hidden');
      return;
    }

    resultsList.classList.remove('hidden');
  }

  function renderResults() {
    const items = filteredResults();
    updateVisibility(lastQuery.length > 0, items);
    resultsList.innerHTML = '';

    items.forEach((result, index) => {
      const card = document.createElement('div');
      card.className = 'lookup-card';
      card.style.setProperty('--stagger', String(Math.min(index, 8)));
      const authors = result.authors?.join(', ');
      const isAdded = addedIds.has(result.id);

      const title = escapeHtml(result.title);
      const addLabel = isAdded ? 'Added to library' : 'Add to library';

      card.setAttribute('role', 'listitem');
      card.innerHTML = `
        <div class="lookup-card-body">
          <p class="lookup-card-title">${title}</p>
          <div class="lookup-card-meta">
            <span class="lookup-source-badge lookup-source-${result.source}">${SOURCE_LABELS[result.source]}</span>
            ${authors ? `<span class="lookup-card-authors">${escapeHtml(authors)}</span>` : ''}
          </div>
          ${result.snippet ? `<p class="lookup-snippet">${escapeHtml(result.snippet)}</p>` : ''}
        </div>
        <div class="lookup-card-actions">
          <button type="button" class="btn btn-secondary btn-small lookup-preview-btn" data-id="${escapeHtml(result.id)}" aria-label="Preview ${title}">
            <span class="icon" aria-hidden="true">${sym.preview}</span><span class="btn-label">Preview</span>
          </button>
          <button type="button" class="btn ${isAdded ? 'btn-done' : 'btn-primary'} btn-small lookup-add-btn" data-id="${escapeHtml(result.id)}" aria-label="${addLabel}: ${title}" ${isAdded ? 'disabled' : ''}>
            <span class="icon" aria-hidden="true">${isAdded ? sym.check : sym.add}</span><span class="btn-label">${isAdded ? 'Added' : 'Add'}</span>
          </button>
        </div>
      `;

      card.querySelector('.lookup-preview-btn')?.addEventListener('click', () => {
        void previewResult(result);
      });

      card.querySelector('.lookup-add-btn')?.addEventListener('click', () => {
        void addResult(result);
      });

      resultsList.appendChild(card);
    });
  }

  async function previewResult(result: LookupResult) {
    const hideLoading = showLoading(loadingRoot, 'Fetching the preview…');
    try {
      const { blob } = await fetchPdfFromUrl(result.pdfUrl);
      cachePreviewBlob(result.id, blob);
      callbacks.onPreview(result, blob);
    } catch (err) {
      showToast(downloadErrorMessage(err), { isError: true });
      logger.logError('Failed to load preview', err);
    } finally {
      hideLoading();
    }
  }

  async function addResult(result: LookupResult) {
    const hideLoading = showLoading(loadingRoot, 'Adding to your shelf…');
    try {
      const meta = await addLookupResultToLibrary(result);
      addedIds.add(result.id);
      remember();
      renderResults();
      showToast(`Added “${meta.name}” to your library`);
      callbacks.onAdded(meta);
    } catch (err) {
      showToast(downloadErrorMessage(err), { isError: true });
      logger.logError('Failed to add lookup result', err);
    } finally {
      hideLoading();
    }
  }

  async function runSearch() {
    const query = queryInput.value.trim();
    if (!query) {
      showToast('Type a title, author or topic first.', { isError: true });
      queryInput.focus();
      return;
    }

    lastQuery = query;
    lastNotice = '';
    queryInput.blur();
    const hideLoading = showLoading(loadingRoot, 'Looking through the stacks…');
    try {
      const outcome = await searchLookupPdfs({ query });
      allResults = outcome.results;

      if (WEB_SEARCH_ENABLED && outcome.webSearchUnavailable) {
        // Keep the technical reason in the log; show people what it means for them.
        logger.info(`Web search unavailable: ${outcome.webSearchMessage ?? 'unknown reason'}`);
        lastNotice = 'Web results aren’t available right now, so these come from Internet Archive and Gutenberg.';
      }
      remember();

      if (allResults.length === 0 && !lastNotice) {
        throw new AppError(ErrorCodes.LKP_002);
      }

      renderResults();
    } catch (err) {
      if (err instanceof AppError && err.code === ErrorCodes.LKP_002) {
        allResults = [];
        remember();
        renderResults();
      } else {
        showToast(friendlyError(err instanceof AppError ? err : new AppError(ErrorCodes.LKP_001)), { isError: true });
        logger.logError('Lookup search failed', err);
      }
    } finally {
      hideLoading();
    }
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    void runSearch();
  });
  retryBtn.addEventListener('click', () => {
    if (allResults.length > 0 && sourceFilter !== 'all') {
      setFilter('all');
      return;
    }
    queryInput.select();
    queryInput.focus();
  });

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      setFilter((chip.dataset.filter as SourceFilter) ?? 'all');
    });
  });

  queryInput.value = lastQuery;
  syncChips();
  renderResults();

  return panel;
}

type SavedSearch = {
  query: string;
  results: LookupResult[];
  filter: SourceFilter;
  addedIds: Set<string>;
  notice: string;
};

let savedSearch: SavedSearch = { query: '', results: [], filter: 'all', addedIds: new Set(), notice: '' };

function downloadErrorMessage(err: unknown): string {
  const restricted = errorCodeOf(err) === ErrorCodes.LIB_003 && /^HTTP 40[13]\b/.test(errorDetailOf(err));
  return restricted ? 'This one isn’t free to download. Try another result.' : friendlyError(err);
}

