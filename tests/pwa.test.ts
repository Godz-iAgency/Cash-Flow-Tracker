import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('scripts/service-worker.template.js', 'utf8').replaceAll('__VERSION__', 'test');
function worker() {
  const handlers = new Map<string, (event: any) => void>();
  const added: Request[][] = [], deleted: string[] = [], fetched: Request[] = [];
  const offline = new Response('<h1>Connect to open your tracker</h1>', { headers: { 'Content-Type': 'text/html' } });
  let skipped = 0, claimed = 0, failure = false;
  vm.runInNewContext(source, {
    self: { location: { origin: 'https://tracker.example' }, addEventListener: (name: string, listener: (event: any) => void) => handlers.set(name, listener), skipWaiting: () => { skipped++; }, clients: { claim: async () => { claimed++; } } },
    URL, Request: class extends Request { constructor(url: string, options?: RequestInit) { super(new URL(url, 'https://tracker.example'), options); } },
    caches: { open: async () => ({ addAll: async (requests: Request[]) => { added.push(requests); }, match: async (request: string) => request === '/offline.html' ? offline.clone() : undefined }), keys: async () => ['cash-flow-install-old', 'cash-flow-install-test', 'unrelated-cache'], delete: async (name: string) => { deleted.push(name); } },
    fetch: async (request: Request) => { fetched.push(request); if (failure) throw new Error('Offline'); return new Response('network'); },
  });
  return { handlers, added, deleted, fetched, skipped: () => skipped, claimed: () => claimed, fail: () => { failure = true; } };
}
function request(path: string, method = 'GET', headers: HeadersInit = {}, mode = 'cors') {
  return { url: 'https://tracker.example' + path, method, headers: new Headers(headers), mode };
}

test('installation caches only public assets and never activates an update without a request', async () => {
  const w = worker(); let pending: Promise<void> | undefined;
  w.handlers.get('install')!({ waitUntil: (value: Promise<void>) => { pending = value; } }); await pending;
  assert.equal(w.skipped(), 0);
  assert.equal(w.added[0].length, 6);
  assert.ok(w.added[0].every(r => ['/offline.html', '/manifest.webmanifest'].includes(new URL(r.url).pathname) || new URL(r.url).pathname.startsWith('/icons/')));
  assert.ok(w.added[0].every(r => !r.headers.has('Authorization') && r.cache === 'reload'));
  w.handlers.get('message')!({ data: { type: 'OTHER' } }); assert.equal(w.skipped(), 0);
  w.handlers.get('message')!({ data: { type: 'ACTIVATE_UPDATE' } }); assert.equal(w.skipped(), 1);
});
test('financial endpoints, writes, tokens and other origins bypass the installation cache', () => {
  const w = worker();
  const requests = [request('/api'), request('/api/state'), request('/api/status'), request('/api/transactions', 'POST'), request('/icons/icon-192.png', 'GET', { Authorization: 'Bearer private-token' }), { ...request('/icons/icon-192.png'), url: 'https://another.example/icons/icon-192.png' }];
  for (const item of requests) {
    let intercepted = false;
    w.handlers.get('fetch')!({ request: item, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, item.url);
  }
});
test('navigation uses the network and offline fallback contains no financial state', async () => {
  const w = worker(); let response: Promise<Response> | undefined;
  const event = { request: request('/', 'GET', {}, 'navigate'), respondWith: (value: Promise<Response>) => { response = value; } };
  w.handlers.get('fetch')!(event); assert.equal(await (await response!).text(), 'network');
  w.fail(); w.handlers.get('fetch')!(event); assert.match(await (await response!).text(), /Connect to open/);
});
test('activation cleans only old installation caches without touching other storage', async () => {
  const w = worker(); let pending: Promise<void> | undefined;
  w.handlers.get('activate')!({ waitUntil: (value: Promise<void>) => { pending = value; } }); await pending;
  assert.deepEqual(w.deleted, ['cash-flow-install-old']); assert.equal(w.claimed(), 1);
});
