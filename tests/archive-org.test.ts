import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchArchiveOrg } from '../src/lib/lookup/archive-org.ts';

test('Internet Archive search excludes lending-library (access-restricted) items', async () => {
  const requested: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL) => {
    requested.push(String(input));
    return new Response(JSON.stringify({ response: { docs: [] } }), { status: 200 });
  }) as typeof fetch;
  try {
    await searchArchiveOrg('alice');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(requested.length, 1);
  const q = new URL(requested[0]).searchParams.get('q') ?? '';
  assert.match(q, /AND NOT access-restricted-item:true/);
  assert.match(q, /mediatype:texts/);
});
