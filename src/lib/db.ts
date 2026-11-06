import Dexie, { type EntityTable } from 'dexie';
import type { StoredPdfData } from './pdf-data';

export interface PdfRecord {
  id: string;
  name: string;
  size: number;
  dateAdded: number;
  lastOpened: number;
  currentPage: number;
  totalPages: number;
  /** ArrayBuffer for new records; legacy records may still hold a Blob (see pdf-data.ts). */
  data: StoredPdfData;
}

class DeezPdfDatabase extends Dexie {
  pdfs!: EntityTable<PdfRecord, 'id'>;

  constructor() {
    super('DeezPdfReader');
    this.version(1).stores({
      pdfs: 'id, name, dateAdded, lastOpened',
    });
  }
}

export const db = new DeezPdfDatabase();

export function generateId(): string {
  return crypto.randomUUID();
}
