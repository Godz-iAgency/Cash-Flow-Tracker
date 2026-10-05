import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, writeFile, rm, mkdir, readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { JWT } from 'google-auth-library';
import { createApp } from '../server/app';
import { readFirebaseServiceAccount } from '../server/credentials';
import { reportsConfigured, exportSnapshot } from '../server/sheets';
import { initialState } from '../shared/seed';

const credential = { project_id: 'hosting-test', client_email: 'test@hosting-test.iam.gserviceaccount.com', private_key: generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey };
const variables = ['STORAGE_BACKEND', 'APP_ORIGIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_APP_ID', 'FIREBASE_OWNER_EMAIL', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'FIREBASE_SERVICE_ACCOUNT_PATH', 'GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];
async function environment(operation: () => Promise<void>) {
  const saved = Object.fromEntries(variables.map(key => [key, process.env[key]]));
  variables.forEach(key => delete process.env[key]);
  try { await operation(); } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
function configure() {
  Object.assign(process.env, { STORAGE_BACKEND: 'firestore', APP_ORIGIN: 'https://tracker.example', FIREBASE_PROJECT_ID: 'hosting-test', FIREBASE_API_KEY: 'public-web-api-key', FIREBASE_AUTH_DOMAIN: 'hosting-test.firebaseapp.com', FIREBASE_APP_ID: 'test-app-id', FIREBASE_OWNER_EMAIL: 'owner@example.invalid', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(credential), GOOGLE_SHEET_ID: 'report-sheet' });
}
async function serve(app: ReturnType<typeof createApp>, operation: (root: string) => Promise<void>) {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try { await operation(root); } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

test('hosted mode refuses incomplete storage setup rather than switching to device mode', async () => environment(async () => {
  const { default: handler } = await import(pathToFileURL(path.resolve('api/index.js')).href);
  await serve(handler, async root => {
    for (const endpoint of ['/api/status', '/api/state', '/api/cloud/info']) {
      const response = await fetch(root + endpoint); assert.equal(response.status, 503);
      assert.match((await response.json()).error, /Vercel environment variables/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  });
}));

test('server JSON credential supports status and Sheets without exposing its private fields', async () => environment(async () => {
  configure();
  assert.deepEqual(readFirebaseServiceAccount(), credential);
  assert.equal(reportsConfigured(), true);
  await serve(createApp({ hosted: true }), async root => {
    const response = await fetch(root + '/api/status'); assert.equal(response.status, 200);
    const status = await response.json();
    assert.equal(status.backend, 'firestore'); assert.equal(status.configured, true); assert.equal(status.authenticated, false); assert.equal(status.sheetsExportEnabled, true);
    assert.deepEqual(status.firebase, { projectId: 'hosting-test', apiKey: 'public-web-api-key', authDomain: 'hosting-test.firebaseapp.com', appId: 'test-app-id' });
    const publicData = JSON.stringify(status); assert.ok(!publicData.includes('private_key')); assert.ok(!publicData.includes('BEGIN PRIVATE KEY')); assert.ok(!publicData.includes(credential.client_email));
    assert.equal((await fetch(root + '/api/cloud/info')).status, 401);
    assert.equal((await fetch(root + '/api/state')).status, 401);
    assert.equal((await fetch(root + '/api/unknown')).status, 401);
  });
}));

test('HTTPS write origin works through a proxy while foreign and forged forwarded origins stay blocked', async () => environment(async () => {
  configure();
  await serve(createApp({ hosted: true }), async root => {
    const request = (origin: string) => fetch(root + '/api/cloud/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'evil.example' }, body: '{}' });
    assert.equal((await request('https://tracker.example')).status, 401); // Origin accepted; identity still required.
    assert.equal((await request('https://evil.example')).status, 403);
    assert.equal((await request('http://tracker.example')).status, 403);
    assert.equal((await fetch(root + '/api/cloud/import', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'https://tracker.example' }, body: '{}' })).status, 415);
  });
}));

test('Sheets reports sign with the server JSON credential when separate Sheets keys are unset', async () => environment(async () => {
  configure();
  const previousFetch = globalThis.fetch, previousToken = JWT.prototype.getAccessToken;
  let tokens = 0, batches = 0;
  JWT.prototype.getAccessToken = async function () { assert.equal(this.email, credential.client_email); assert.equal(this.key, credential.private_key); tokens++; return { token: 'hosting-test-token' }; };
  globalThis.fetch = async (_url, options) => {
    if (!options?.body) return new Response(JSON.stringify({ sheets: [] }));
    assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer hosting-test-token');
    batches++; return new Response(JSON.stringify({ replies: [] }));
  };
  try { const state = initialState(), original = structuredClone(state); const report = await exportSnapshot(state); assert.equal(report.tabs.length, 14); assert.equal(batches, 1); assert.ok(tokens > 0); assert.deepEqual(state, original); }
  finally { globalThis.fetch = previousFetch; JWT.prototype.getAccessToken = previousToken; }
}));

test('malformed credentials and another project are rejected without echoing secret content', async () => environment(async () => {
  configure(); process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{"private_key":"secret-fragment"';
  assert.throws(readFirebaseServiceAccount, error => error instanceof Error && !error.message.includes('secret-fragment'));
  await serve(createApp({ hosted: true }), async root => { assert.equal((await fetch(root + '/api/status')).status, 503); });
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ ...credential, project_id: 'different-project' });
  assert.throws(readFirebaseServiceAccount, /different project/);
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'hosting-test' });
  assert.throws(readFirebaseServiceAccount, /valid service-account/);
  configure(); process.env.APP_ORIGIN = 'https://tracker.example/some/path';
  await serve(createApp({ hosted: true }), async root => { assert.equal((await fetch(root + '/api/status')).status, 503); });
}));

test('local credential files remain supported and explicit invalid JSON never falls back to a file', async () => environment(async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cash-flow-hosting-'));
  try {
    const filename = path.join(directory, 'test-credential.json'); await writeFile(filename, JSON.stringify(credential));
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = filename; process.env.FIREBASE_PROJECT_ID = 'hosting-test';
    assert.deepEqual(readFirebaseServiceAccount(), credential);
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = 'invalid-json';
    assert.throws(readFirebaseServiceAccount, /could not be read/);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('cash-flow-hosting-'));
    await rm(directory, { recursive: true, force: true });
  }
}));

test('compiled hosted API starts in plain Node ESM without the development loader', async () => {
  const parent = path.resolve('.local'); await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'compiled-hosting-'));
  try {
    for (const folder of ['api', 'server', 'shared']) {
      await mkdir(path.join(directory, folder), { recursive: true });
      for (const filename of await readdir(folder)) {
        if (!filename.endsWith('.ts')) continue;
        const source = await readFile(path.join(folder, filename), 'utf8');
        const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
        await writeFile(path.join(directory, folder, filename.replace(/\.ts$/, '.js')), compiled.outputText);
      }
    }
    const entry = pathToFileURL(path.join(directory, 'server/handler.js')).href;
    const script = `import { createServer } from 'node:http'; const { default: app } = await import(${JSON.stringify(entry)}); const server = createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/status'); console.log(JSON.stringify({ status: response.status, error: (await response.json()).error })); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));`;
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script], { timeout: 45000, env: { ...process.env, STORAGE_BACKEND: '', APP_ORIGIN: '' } });
    const result = JSON.parse(stdout.trim()); assert.equal(result.status, 503); assert.match(result.error, /Vercel environment variables/);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('compiled-hosting-'));
    await rm(directory, { recursive: true, force: true });
  }
});

test('packaged API starts with Vercel module compatibility enabled and rejects anonymous reads', async () => environment(async () => {
  configure();
  const deployment = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(deployment.env.NODE_OPTIONS, '--experimental-require-module');
  const entry = pathToFileURL(path.resolve('api/index.js')).href;
  const script = `import { createServer } from 'node:http'; const { default: app } = await import(${JSON.stringify(entry)}); const server = createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const root = 'http://127.0.0.1:' + server.address().port; const response = await fetch(root + '/api/status'); const status = await response.json(); const data = await fetch(root + '/api/state'); console.log(JSON.stringify({ response: response.status, backend: status.backend, configured: status.configured, authenticated: status.authenticated, state: data.status, secretExposed: JSON.stringify(status).includes('private_key') })); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));`;
  // Vercel disables require(ESM) by default. Apply its documented opt-in last,
  // so the real Firebase dependency graph is tested under that runtime setting.
  const { stdout } = await promisify(execFile)(process.execPath, ['--no-experimental-require-module', deployment.env.NODE_OPTIONS, '--input-type=module', '-e', script], { timeout: 45000, env: { ...process.env } });
  assert.deepEqual(JSON.parse(stdout.trim()), { response: 200, backend: 'firestore', configured: true, authenticated: false, state: 401, secretExposed: false });
}));
