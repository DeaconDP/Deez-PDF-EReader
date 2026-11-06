import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, ErrorCodes } from '../src/lib/errors.ts';
import { errorRecoveryOf } from '../src/lib/error-recovery.ts';

test('damaged, protected or unreadable files offer removal', () => {
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.PDF_001, 'abc')), 'remove');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.PDF_003, 'missing data')), 'remove');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.LIB_001)), 'remove');
});

test('transient or unknown errors offer a retry', () => {
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.PDF_002, 'page 3')), 'retry');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.LIB_003, 'HTTP 500')), 'retry');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.LKP_003)), 'retry');
  assert.equal(errorRecoveryOf(new AppError(ErrorCodes.DB_001)), 'retry');
  assert.equal(errorRecoveryOf(new Error('Failed to fetch')), 'retry');
  assert.equal(errorRecoveryOf('weird'), 'retry');
});
