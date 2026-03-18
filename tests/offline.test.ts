import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.ts';
import { zodSchemaToJsonSchema } from '../src/lib/json-schema.ts';
import { searchMoviesSchema, TOOLS } from '../src/lib/mcp-tools.ts';
import { TMDBClient } from '../src/lib/tmdb-client.ts';

test('zod schema conversion preserves required fields, defaults, and arrays', () => {
  const jsonSchema = zodSchemaToJsonSchema(searchMoviesSchema);

  assert.equal(jsonSchema.type, 'object');
  assert.deepEqual(jsonSchema.required, ['query']);
  assert.equal((jsonSchema.properties as Record<string, Record<string, unknown>>).page.default, 1);
  assert.equal((jsonSchema.properties as Record<string, Record<string, unknown>>).language.default, 'en-US');
});

test('tools endpoint returns the full tool catalog', async () => {
  const response = await app.request('/tools');
  assert.equal(response.status, 200);

  const payload = await response.json() as { count: number; tools: Array<{ name: string }> };
  assert.equal(payload.count, TOOLS.length);
  assert.equal(payload.tools[0]?.name, TOOLS[0]?.name);
  assert.ok(payload.tools.some((tool) => tool.name === 'multi_search'));
  assert.ok(payload.tools.some((tool) => tool.name === 'get_movie_watch_providers'));
  assert.ok(payload.tools.some((tool) => tool.name === 'get_movie_genres'));
});

test('TMDB client caches repeated requests when cache is available', async () => {
  let fetchCount = 0;
  const cacheStore = new Map<string, Response>();

  const originalFetch = globalThis.fetch;
  const originalCaches = (globalThis as typeof globalThis & { caches?: unknown }).caches;

  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ page: 1, results: [], total_pages: 1, total_results: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  (globalThis as typeof globalThis & { caches?: { open: (name: string) => Promise<Cache> } }).caches = {
    open: async () => ({
      match: async (request: RequestInfo | URL) => cacheStore.get(String(request))?.clone(),
      put: async (request: RequestInfo | URL, response: Response) => {
        cacheStore.set(String(request), response.clone());
      },
      add: async () => undefined,
      addAll: async () => undefined,
      delete: async () => false,
      keys: async () => [],
    } as unknown as Cache),
  };

  try {
    const client = new TMDBClient({
      apiKey: 'test-key',
      baseUrl: 'https://example.test',
      imageBaseUrl: 'https://images.example.test',
    });

    await client.initializeCache();
    await client.searchMovies('Alien');
    await client.searchMovies('Alien');

    assert.equal(fetchCount, 1);
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;

    if (originalCaches === undefined) {
      delete (globalThis as typeof globalThis & { caches?: unknown }).caches;
    } else {
      (globalThis as typeof globalThis & { caches?: unknown }).caches = originalCaches;
    }
  }
});
