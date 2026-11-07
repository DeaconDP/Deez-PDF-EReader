/**
 * Android system Back (button or gesture) for the in-memory view router.
 *
 * The app swaps views without touching the URL, so the WebView has no history
 * and Back would close the app from the reader. While a reader is open we keep
 * one history entry; the native MainActivity turns Back into `WebView.goBack()`
 * when it can, which fires `popstate` here and we leave the reader.
 */
export type HistoryLike = {
  pushState(data: unknown, unused: string): void;
  back(): void;
};

export class ReaderBackStack {
  private active = false;
  private ignoreNextPop = false;
  private readonly history: HistoryLike;
  private readonly onSystemBack: () => void;

  constructor(history: HistoryLike, onSystemBack: () => void) {
    this.history = history;
    this.onSystemBack = onSystemBack;
  }

  /** A reader was shown: give Back something to pop. */
  enterReader(): void {
    if (this.active) return;
    this.history.pushState({ deezpdfReader: true }, '');
    this.active = true;
  }

  /** The reader was left another way (on-screen Back, Add to library): drop our entry. */
  leaveReader(): void {
    if (!this.active) return;
    this.active = false;
    this.ignoreNextPop = true;
    this.history.back();
  }

  handlePopState(): void {
    if (this.ignoreNextPop) {
      this.ignoreNextPop = false;
      return;
    }
    if (!this.active) return;
    this.active = false;
    this.onSystemBack();
  }
}
