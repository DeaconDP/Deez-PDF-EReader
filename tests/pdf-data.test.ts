import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfBytesToBlob, readStoredPdfData } from '../src/lib/pdf-data.ts';
import { AppError, ErrorCodes, friendlyError } from '../src/lib/errors.ts';

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

test('ArrayBuffer records are returned as-is and need no migration', async () => {
  const data = bytes('%PDF-1.4 hello');
  const result = await readStoredPdfData(data);
  assert.equal(result.needsMigration, false);
  assert.equal(result.bytes, data);
});

test('legacy Blob records are read and flagged for migration', async () => {
  const blob = new Blob(['%PDF-1.4 legacy'], { type: 'application/pdf' });
  const result = await readStoredPdfData(blob);
  assert.equal(result.needsMigration, true);
  assert.equal(new TextDecoder().decode(result.bytes), '%PDF-1.4 legacy');
});

test('an unreadable legacy Blob becomes ERR-PDF-003, not a generic parse error', async () => {
  const broken = new Blob(['x']);
  broken.arrayBuffer = () => Promise.reject(Object.assign(new Error('The object can not be found here.'), { name: 'NotFoundError' }));
  await assert.rejects(readStoredPdfData(broken), (err: unknown) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.code, ErrorCodes.PDF_003);
    assert.match(err.message, /NotFoundError/);
    return true;
  });
});

test('missing data is reported as unreadable', async () => {
  await assert.rejects(readStoredPdfData(undefined), (err: unknown) => err instanceof AppError && err.code === ErrorCodes.PDF_003);
});

test('pdfBytesToBlob copies so pdf.js can detach its buffer safely', async () => {
  const data = bytes('%PDF-1.7');
  const blob = pdfBytesToBlob(data);
  const copy = await blob.arrayBuffer();
  structuredClone(copy, { transfer: [copy] }); // detach the copy, like pdf.js does
  assert.equal(data.byteLength, 8);
  assert.equal(blob.type, 'application/pdf');
});

test('friendlyError hides codes and raw details', () => {
  const msg = friendlyError(new AppError(ErrorCodes.PDF_001, '1234-uuid'));
  assert.doesNotMatch(msg, /ERR-|uuid/);
  assert.equal(friendlyError(new AppError(ErrorCodes.LIB_001, 'name cannot be empty')), 'Give it a name first.');
  assert.equal(friendlyError(new Error('boom')), 'Something went wrong. Please try again.');
});
