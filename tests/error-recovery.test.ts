import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, ErrorCodes, friendlyError } from '../src/lib/errors.ts';
import { errorRecoveryOf, isPermanentPdfLoadError } from '../src/lib/error-recovery.ts';

/** Shaped like pdf.js 4.x exceptions: a plain Error-like object with a `name`. */
function pdfjsError(name: string): Error {
  const err = new Error('pdf.js said no');
  err.name = name;
  return err;
}

test('damaged, protected or unreadable files offer removal', () => {
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.PDF_001, 'abc', { permanent: true })), 'remove');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.PDF_003, 'missing data')), 'remove');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.LIB_001)), 'remove');
});

test('a load failure is permanent only when pdf.js blames the file', () => {
  for (const name of ['InvalidPDFException', 'PasswordException', 'MissingPDFException']) {
    assert.equal(isPermanentPdfLoadError(pdfjsError(name)), true, name);
  }
  for (const name of ['UnexpectedResponseException', 'UnknownErrorException', 'NotFoundError', 'RangeError', 'Error']) {
    assert.equal(isPermanentPdfLoadError(pdfjsError(name)), false, name);
  }
  assert.equal(isPermanentPdfLoadError(undefined), false);
  assert.equal(isPermanentPdfLoadError('InvalidPDFException'), false);
});

test('transient load failures keep Try again and say so', () => {
  const transient = new AppError(ErrorCodes.PDF_001, 'abc');
  assert.equal(errorRecoveryOf(transient), 'retry');
  assert.match(friendlyError(transient), /Try again/);
  assert.match(friendlyError(new AppError(ErrorCodes.PDF_001, 'abc', { permanent: true })), /damaged or protected/);
});

test('transient or unknown errors offer a retry', () => {
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.PDF_002, 'page 3')), 'retry');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.LIB_003, 'HTTP 500')), 'retry');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.LKP_003)), 'retry');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.DB_001)), 'retry');
  assert.equal(errorRecoveryOf(new Error('Failed to fetch')), 'retry');
  assert.equal(errorRecoveryOf(pdfjsError('InvalidPDFException')), 'retry'); // unwrapped: not ours to judge
  assert.equal(errorRecoveryOf('weird'), 'retry');
});
