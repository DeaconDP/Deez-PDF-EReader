import { AppError, ErrorCodes, errorCodeOf } from './errors.ts';

/**
 * What the reader's error screen should offer.
 * - `remove`: the file itself is the problem (damaged, password-protected,
 *   or the stored copy can't be read). Trying again can't help, so offer
 *   "Remove from library".
 * - `retry`: something that might work next time (render hiccup, memory,
 *   worker, storage, network/download, or an unknown error).
 */
export type ErrorRecovery = 'remove' | 'retry';

/** Codes that are always permanent, whatever raised them. */
const ALWAYS_PERMANENT: ReadonlySet<string> = new Set([
  ErrorCodes.PDF_003, // stored copy unreadable (or missing)
  ErrorCodes.LIB_001, // file couldn't be read as a PDF
]);

/**
 * pdf.js (4.x) errors that mean the bytes themselves are bad: not a PDF or
 * damaged, password-protected, or empty. Matched by `name`, which pdf.js sets
 * on its exceptions and keeps across the worker boundary. Anything else
 * (UnexpectedResponseException, UnknownErrorException, worker, memory or
 * render failures) may work next time.
 */
const PERMANENT_PDFJS_ERRORS: ReadonlySet<string> = new Set([
  'InvalidPDFException',
  'PasswordException',
  'MissingPDFException',
]);

/** Whether an error thrown by pdf.js (or reading the blob) means retrying can't help. */
export function isPermanentPdfLoadError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return typeof name === 'string' && PERMANENT_PDFJS_ERRORS.has(name);
}

export function errorRecoveryOf(err: unknown): ErrorRecovery {
  const code = errorCodeOf(err);
  if (!code) return 'retry';
  if (ALWAYS_PERMANENT.has(code)) return 'remove';
  return err instanceof AppError && err.permanent ? 'remove' : 'retry';
}
