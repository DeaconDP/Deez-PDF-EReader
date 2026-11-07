export function createLoadingOverlay(message = 'One moment…'): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="loading-card">
      <div class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="loading-text"></p>
    </div>
  `;
  (overlay.querySelector('.loading-text') as HTMLElement).textContent = message;
  return overlay;
}

export function showLoading(container: HTMLElement, message?: string): () => void {
  const overlay = createLoadingOverlay(message);
  container.appendChild(overlay);
  container.setAttribute('aria-busy', 'true');
  return () => {
    overlay.remove();
    if (!container.querySelector('.loading-overlay')) container.removeAttribute('aria-busy');
  };
}
