export const ErrorCodes = {
  LCH_001: 'ERR-LCH-001',
  LCH_002: 'ERR-LCH-002',
  LIB_001: 'ERR-LIB-001',
  LIB_002: 'ERR-LIB-002',
  LIB_003: 'ERR-LIB-003',
  LIB_004: 'ERR-LIB-004',
  LKP_001: 'ERR-LKP-001',
  LKP_002: 'ERR-LKP-002',
  LKP_003: 'ERR-LKP-003',
  PDF_001: 'ERR-PDF-001',
  PDF_002: 'ERR-PDF-002',
  PDF_003: 'ERR-PDF-003',
  DB_001: 'ERR-DB-001',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const messages: Record<ErrorCode, string> = {
  'ERR-LCH-001': 'Node.js is not installed. Download from https://nodejs.org',
  'ERR-LCH-002': 'Failed to bind to a network port',
  'ERR-LIB-001': 'Failed to read PDF file',
  'ERR-LIB-002': 'Folder picker is not supported in this browser',
  'ERR-LIB-003': 'Failed to download PDF from URL',
  'ERR-LIB-004': 'Save location picker is not supported in this browser',
  'ERR-LKP-001': 'PDF lookup search failed',
  'ERR-LKP-002': 'No PDFs found for that search',
  'ERR-LKP-003': 'Failed to load PDF preview',
  'ERR-PDF-001': 'Failed to load or parse PDF',
  'ERR-PDF-002': 'Failed to render PDF page',
  'ERR-PDF-003': 'Stored PDF data is unreadable',
  'ERR-DB-001': 'Failed to save data to local storage',
};

export type AppErrorOptions = {
  /**
   * The file itself is the problem (e.g. pdf.js says it is damaged or
   * password-protected), so trying again can't help. Defaults to false.
   */
  permanent?: boolean;
};

export class AppError extends Error {
  code: ErrorCode;
  permanent: boolean;

  constructor(code: ErrorCode, detail?: string, options?: AppErrorOptions) {
    const base = messages[code];
    super(detail ? `${base}: ${detail}` : base);
    this.code = code;
    this.name = 'AppError';
    this.permanent = Boolean(options?.permanent);
  }
}

export function formatError(err: unknown): string {
  if (err instanceof AppError) {
    return `[${err.code}] ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Plain-language messages for people. Error codes and raw details stay in the
 * log (`formatError`) and in the debug panel; screens and toasts use these.
 */
const friendlyMessages: Record<ErrorCode, string> = {
  'ERR-LCH-001': 'Node.js is needed to run DeezPDF on this computer.',
  'ERR-LCH-002': 'DeezPDF couldn’t start its local server.',
  'ERR-LIB-001': 'That file couldn’t be read. Is it a PDF?',
  'ERR-LIB-002': 'Adding a whole folder isn’t supported here. Use Add, then pick the PDFs themselves.',
  'ERR-LIB-003': 'That link didn’t give us a PDF. Check it ends in .pdf and try again.',
  'ERR-LIB-004': 'Choosing a save location isn’t supported here.',
  'ERR-LKP-001': 'Search didn’t work this time. Check your connection and try again.',
  'ERR-LKP-002': 'No PDFs found for that search.',
  'ERR-LKP-003': 'That preview didn’t load. Try another result.',
  'ERR-PDF-001': 'This PDF couldn’t be opened. It may be damaged or protected.',
  'ERR-PDF-002': 'This page didn’t draw properly. Try turning the page.',
  'ERR-PDF-003': 'The saved copy of this PDF can’t be read any more. Remove it and add it again.',
  'ERR-DB-001': 'We couldn’t save that on this device. Free up some space and try again.',
};

/** Specific validation messages that are already friendly, keyed by AppError detail. */
const friendlyDetails: Record<string, string> = {
  'name cannot be empty': 'Give it a name first.',
  'Save cancelled': 'Cancelled, so nothing was added.',
  'URL is required': 'Paste a PDF link first.',
  'Invalid URL': 'That doesn’t look like a web link. It should start with https://',
  'Only http and https URLs are supported': 'That doesn’t look like a web link. It should start with https://',
};

/** The technical detail after the base message, e.g. "HTTP 401" for ERR-LIB-003. */
export function errorDetailOf(err: unknown): string {
  if (!(err instanceof AppError)) return '';
  return err.message.slice(messages[err.code].length).replace(/^:\s*/, '');
}

function friendlyDownloadError(detail: string): string | undefined {
  const status = /^HTTP (\d{3})/.exec(detail)?.[1];
  if (status === '401' || status === '403') return 'That file is private or needs a login, so it can’t be downloaded.';
  if (status === '404') return 'Nothing is at that link any more. Check it and try again.';
  if (status) return `That site said no (error ${status}). Try again later.`;
  if (/not a (valid )?PDF/i.test(detail)) return friendlyMessages['ERR-LIB-003'];
  if (friendlyDetails[detail]) return undefined;
  return 'We couldn’t reach that link. Check your connection and try again.';
}

export function friendlyError(err: unknown): string {
  if (err instanceof AppError) {
    const detail = errorDetailOf(err);
    // A load that failed for a passing reason (memory, worker) isn't "damaged".
    if (err.code === 'ERR-PDF-001' && !err.permanent) return 'This PDF didn’t open this time. Try again.';
    if (err.code === 'ERR-LIB-003') {
      const download = friendlyDownloadError(detail);
      if (download) return download;
    }
    return friendlyDetails[detail] ?? friendlyMessages[err.code];
  }
  return 'Something went wrong. Please try again.';
}

export function errorCodeOf(err: unknown): ErrorCode | undefined {
  return err instanceof AppError ? err.code : undefined;
}

/** Escape text for HTML content *and* quoted attribute values. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
