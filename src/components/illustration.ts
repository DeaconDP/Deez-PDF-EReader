/**
 * DeezPDF's "page buddy": a flat vector page with a face, drawn in code.
 * No outlines, rounded geometry, soft orb behind, a few stars. Colours come
 * from CSS (`.illo-*` classes in app.css) so it follows light/dark mode.
 * Decorative only: always rendered with aria-hidden.
 */
export type BuddyMood = 'happy' | 'curious' | 'sad' | 'reading';

const MOUTHS: Record<BuddyMood, string> = {
  happy: '<path class="illo-line" d="M52 74c4 5 12 5 16 0"/>',
  reading: '<path class="illo-line" d="M54 75c3 3 9 3 12 0"/>',
  curious: '<ellipse class="illo-ink" cx="60" cy="76" rx="3.4" ry="4"/>',
  sad: '<path class="illo-line" d="M52 78c4-5 12-5 16 0"/>',
};

const EYES: Record<BuddyMood, string> = {
  happy: '<path class="illo-line" d="M45 63c2-3 6-3 8 0M67 63c2-3 6-3 8 0"/>',
  reading: '<ellipse class="illo-ink" cx="49" cy="64" rx="3.2" ry="3.6"/><ellipse class="illo-ink" cx="71" cy="64" rx="3.2" ry="3.6"/>',
  curious: '<ellipse class="illo-ink" cx="50" cy="62" rx="3.4" ry="4.2"/><ellipse class="illo-ink" cx="72" cy="62" rx="3.4" ry="4.2"/><circle class="illo-glint" cx="51.2" cy="60.6" r="1.2"/><circle class="illo-glint" cx="73.2" cy="60.6" r="1.2"/>',
  sad: '<ellipse class="illo-ink" cx="49" cy="65" rx="3.2" ry="3.6"/><ellipse class="illo-ink" cx="71" cy="65" rx="3.2" ry="3.6"/><path class="illo-line" d="M43 59.5l7-3M77 59.5l-7-3"/>',
};

export function pageBuddy(mood: BuddyMood = 'happy', size = 120): string {
  return `
    <svg class="illo illo-${mood}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" focusable="false">
      <circle class="illo-orb" cx="60" cy="62" r="50"/>
      <circle class="illo-orb-inner" cx="60" cy="62" r="36"/>
      <path class="illo-star" d="M100 22c.8 4.6 2.7 6.5 7.3 7.3-4.6.8-6.5 2.7-7.3 7.3-.8-4.6-2.7-6.5-7.3-7.3 4.6-.8 6.5-2.7 7.3-7.3z"/>
      <circle class="illo-star-2" cx="18" cy="34" r="3.5"/>
      <circle class="illo-star" cx="14" cy="88" r="2.4"/>
      <g class="illo-float">
        <ellipse class="illo-shadow" cx="60" cy="106" rx="24" ry="4.5"/>
        <g transform="rotate(-6 60 62)">
          <path class="illo-page" d="M38 26h32l16 16v52a6 6 0 0 1-6 6H38a6 6 0 0 1-6-6V32a6 6 0 0 1 6-6z"/>
          <path class="illo-fold" d="M70 26l16 16H74a4 4 0 0 1-4-4z"/>
          ${EYES[mood]}
          <ellipse class="illo-cheek" cx="42" cy="72" rx="4.5" ry="3"/>
          <ellipse class="illo-cheek" cx="78" cy="72" rx="4.5" ry="3"/>
          ${MOUTHS[mood]}
        </g>
      </g>
    </svg>`;
}
