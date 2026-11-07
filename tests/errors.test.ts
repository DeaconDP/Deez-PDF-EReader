import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, ErrorCodes, escapeHtml, friendlyError } from '../src/lib/errors.ts';

const dl = (detail: string) => friendlyError(new AppError(ErrorCodes.LIB_003, detail));

test('download failures get a reason-specific message', () => {
  assert.match(dl('HTTP 401'), /private or needs a login/);
  assert.match(dl('HTTP 403'), /private or needs a login/);
  assert.match(dl('HTTP 404'), /Nothing is at that link/);
  assert.match(dl('HTTP 500'), /error 500/);
  assert.match(dl('Response is not a PDF'), /didn’t give us a PDF/);
  assert.match(dl('Invalid URL'), /should start with https/);
  assert.match(dl('Failed to fetch'), /couldn’t reach that link/);
  assert.equal(dl('Save cancelled'), 'Cancelled, so nothing was added.');
});

test('escapeHtml is safe inside quoted attributes', () => {
  const title = 'The nursery "Alice" <b>&</b> it\'s';
  const html = `<button aria-label="Preview ${escapeHtml(title)}"></button>`;
  assert.equal(html, '<button aria-label="Preview The nursery &quot;Alice&quot; &lt;b&gt;&amp;&lt;/b&gt; it&#39;s"></button>');
  assert.doesNotMatch(escapeHtml('x" onfocus="alert(1)'), /"/);
});
