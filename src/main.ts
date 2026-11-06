import './styles/tokens.css';
import './styles/app.css';
import { createLibraryView, type LibraryTab } from './views/library';
import { createReaderView } from './views/reader';
import { initDebugPanel } from './components/debug-panel';
import { addLookupResultToLibrary } from './lib/library';
import { logger } from './lib/logger';
import { initNativeShell } from './lib/native-shell';
import { isNativeApp } from './lib/platform';
import type { LookupResult } from './lib/lookup/types';

const app = document.getElementById('app')!;
let currentView: HTMLElement | null = null;

function mount(view: HTMLElement) {
  if (currentView) {
    // Views listen for this to tear down (the reader frees its PDF and listeners).
    currentView.dispatchEvent(new Event('remove'));
    currentView.remove();
  }
  currentView = view;
  app.classList.toggle('reader-active', view.classList.contains('reader-view'));
  view.classList.add('view-enter');
  view.addEventListener(
    'animationend',
    () => view.classList.remove('view-enter'),
    { once: true },
  );
  app.insertBefore(view, app.querySelector('.app-footer') ?? null);
}

function showLibrary(options?: { tab?: LibraryTab; toast?: string; removePdfId?: string }) {
  const library = createLibraryView(
    {
      onOpenPdf: (id) => {
        void openLibraryReader(id);
      },
      onPreview: (result, blob) => {
        void openPreviewReader(result, blob, () => showLibrary({ tab: 'find' }));
      },
    },
    { initialTab: options?.tab, toast: options?.toast, removePdfId: options?.removePdfId },
  );
  mount(library);
}

async function openLibraryReader(id: string) {
  const { view, load } = createReaderView({ mode: 'library', pdfId: id }, {
    onBack: () => showLibrary(),
    // Offered on the reader's error screen for damaged or unreadable files.
    // The library hides it at once and offers Undo; the data goes when that ends.
    onRemoveFromLibrary: (pdfId) => {
      showLibrary({ tab: 'library', removePdfId: pdfId });
    },
  });
  mount(view);
  await load();
}

async function openPreviewReader(
  result: LookupResult,
  blob: Blob,
  onBack: () => void,
) {
  const { view, load } = createReaderView(
    {
      mode: 'preview',
      blob,
      title: result.title,
      pdfUrl: result.pdfUrl,
      resultId: result.id,
    },
    {
      onBack,
      onAddToLibrary: async () => {
        const meta = await addLookupResultToLibrary(result);
        logger.info(`Added lookup preview to library: ${meta.name}`);
        showLibrary({ tab: 'library', toast: `Added “${meta.name}” to your library` });
      },
    },
  );
  mount(view);
  await load();
}

async function setupPWA() {
  if (isNativeApp()) return;

  const { setupPWA: registerAppSW } = await import('./lib/pwa');
  registerAppSW();
}

async function boot() {
  logger.info('DeezPDF Reader starting');
  initDebugPanel(app);
  await initNativeShell();
  await setupPWA();
  showLibrary();
}

boot();
