import { ErrorCodes, errorCodeOf } from './errors.ts';

/**
 * What the reader's error screen should offer.
 * - `remove`: the file itself is the problem (damaged, password-protected,
 *   or the stored copy can't be read). Trying again can't help, so offer
 *   "Remove from library".
 * - `retry`: something that might work next time (render hiccup, storage,
 *   network/download, or an unknown error).
 */
export type ErrorRecovery = 'remove' | 'retry';

const PERMANENT: ReadonlySet<string> = new Set([
  ErrorCodes.PDF_001, // failed to load or parse: damaged, not a PDF, or password-protected
  ErrorCodes.PDF_003, // stored copy unreadable (or missing)
  ErrorCodes.LIB_001, // file couldn't be read as a PDF
]);

export function errorRecoveryOf(err: unknown): ErrorRecovery {
  const code = errorCodeOf(err);
  return code && PERMANENT.has(code) ? 'remove' : 'retry';
}
