/**
 * Rounded line icons drawn in-app (no icon font, no network). 24×24 grid,
 * round caps and joins, `currentColor` so they follow the text colour.
 * Always place them inside an element with `aria-hidden="true"`.
 */
function icon(body: string, opts: { fill?: boolean } = {}): string {
  const paint = opts.fill
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="svg-icon" viewBox="0 0 24 24" width="24" height="24" ${paint} focusable="false" aria-hidden="true">${body}</svg>`;
}

const chevronLeft = icon('<path d="M14.5 5.5 8 12l6.5 6.5"/>');
const chevronRight = icon('<path d="M9.5 5.5 16 12l-6.5 6.5"/>');
const plus = icon('<path d="M12 5v14M5 12h14"/>');
const xmark = icon('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>');

export const sym = {
  search: icon('<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>'),
  lookup: icon('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5M12 3.5C9.6 5.9 8.6 8.7 8.6 12s1 6.1 3.4 8.5"/>'),
  add: plus,
  folder: icon('<path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2.2h7.2a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
  download: icon('<path d="M10 14.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 9.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>'),
  link: icon('<path d="M10 14.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 9.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>'),
  preview: icon('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  document: icon('<path d="M6.5 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M13.5 3.5V8H18"/><path d="M8.5 12.5h7M8.5 16h4.5"/>'),
  back: chevronLeft,
  prev: chevronLeft,
  next: chevronRight,
  remove: icon('<path d="M4.5 7h15M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7M6.5 7l.8 11.6c.1 1 .9 1.9 2 1.9h5.4c1 0 1.9-.8 2-1.9L17.5 7"/>'),
  edit: icon('<path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10z"/><path d="m13.5 6.5 4 4"/>'),
  close: xmark,
  warn: icon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5"/><circle cx="12" cy="16.2" r="0.6" fill="currentColor"/>'),
  swipe: icon('<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>'),
  text: icon('<path d="M4 18.5 9 5.5l5 13M5.8 14h6.4"/><path d="M15.5 11.2c.6-.9 1.6-1.4 2.7-1.4 1.6 0 2.8 1 2.8 2.7v6"/><path d="M21 15.2c-.7-.4-1.6-.6-2.5-.6-1.7 0-2.9.9-2.9 2.1s1 2 2.4 2c1.3 0 2.4-.7 3-1.6"/>'),
  fontDecrease: icon('<path d="M3.5 18 7.5 7l4 11M5 14.5h5"/><path d="M14.5 12.5h6"/>'),
  fontIncrease: icon('<path d="M3.5 18 7.5 7l4 11M5 14.5h5"/><path d="M14.5 12.5h6M17.5 9.5v6"/>'),
  darkMode: icon('<path d="M19.5 14.2A8 8 0 0 1 9.8 4.5 8 8 0 1 0 19.5 14.2z"/>'),
  lightMode: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  filter: icon('<path d="M4 6.5h16M7 12h10M10 17.5h4"/>'),
  sort: icon('<path d="M7.5 4.5v15M4 16l3.5 3.5L11 16M16.5 19.5v-15M13 8l3.5-3.5L20 8"/>'),
  empty: icon('<path d="M6.5 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M13.5 3.5V8H18"/>'),
  more: icon('<circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/>', { fill: true }),
  check: icon('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  sparkle: icon('<path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5z"/>', { fill: true }),
  refresh: icon('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'),
  chevronDown: icon('<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>'),
} as const;
