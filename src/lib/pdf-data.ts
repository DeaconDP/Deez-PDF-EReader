import { AppError, ErrorCodes } from './errors.ts';

/**
 * How a PDF's bytes are stored in IndexedDB.
 *
 * Records written before the redesign stored a `Blob`. In the Capacitor iOS
 * WKWebView those IndexedDB-backed Blobs can become unreadable later
 * (`NotFoundError: The object can not be found here.`), so the PDF never opens
 * again. New records store a plain `ArrayBuffer`, which is kept inline by
 * structured clone and stays readable.
 */
export type StoredPdfData = ArrayBuffer | Blob;

export type ReadPdfDataResult = {
  bytes: ArrayBuffer;
  /** true when the record still holds a legacy Blob and should be rewritten as bytes */
  needsMigration: boolean;
};

export function isLegacyBlob(data: StoredPdfData): data is Blob {
  return typeof Blob !== 'undefined' && data instanceof Blob;
}

export async function readStoredPdfData(data: StoredPdfData | undefined | null): Promise<ReadPdfDataResult> {
  if (data instanceof ArrayBuffer) {
    return { bytes: data, needsMigration: false };
  }
  if (data && isLegacyBlob(data)) {
    try {
      return { bytes: await data.arrayBuffer(), needsMigration: true };
    } catch (err) {
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      throw new AppError(ErrorCodes.PDF_003, reason);
    }
  }
  throw new AppError(ErrorCodes.PDF_003, 'missing data');
}

/** Wrap stored bytes for pdf.js. Copies, so pdf.js can transfer its buffer without detaching ours. */
export function pdfBytesToBlob(bytes: ArrayBuffer): Blob {
  return new Blob([bytes.slice(0)], { type: 'application/pdf' });
}
