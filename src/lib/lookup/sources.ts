import type { LookupSource } from './types';

/**
 * Web PDF search (deac.online/api/pdf-search) is off until the endpoint is
 * deployed: it currently answers 404. While false, the "Web" chip and the
 * "Web results aren't available" notice are hidden and the endpoint is never
 * called. Flip to true to bring all of it back.
 */
export const WEB_SEARCH_ENABLED = false;

export type SourceFilter = 'all' | LookupSource;

const ALL_SOURCES: readonly LookupSource[] = ['archive', 'gutenberg', 'web'];

/** Sources people can search and filter by right now, in chip order. */
export function enabledSources(webEnabled = WEB_SEARCH_ENABLED): LookupSource[] {
  return ALL_SOURCES.filter((source) => webEnabled || source !== 'web');
}

/** A remembered filter for a source that is switched off falls back to "all". */
export function usableSourceFilter(filter: SourceFilter, webEnabled = WEB_SEARCH_ENABLED): SourceFilter {
  if (filter === 'all') return 'all';
  return enabledSources(webEnabled).includes(filter) ? filter : 'all';
}
