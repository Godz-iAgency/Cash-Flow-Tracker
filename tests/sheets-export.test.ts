import test from 'node:test';
import assert from 'node:assert/strict';
import { JWT } from 'google-auth-library';
import { exportSnapshot } from '../server/sheets';
import { initialState } from '../shared/seed';

test('Firestore report export creates dated tabs in one batch and never overwrites existing sheets or formulas', async () => {
  const env = { id: process.env.GOOGLE_SHEET_ID, email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY };
  const previousFetch = globalThis.fetch, previousToken = JWT.prototype.getAccessToken;
  process.env.GOOGLE_SHEET_ID = 'reports-only'; process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.invalid'; process.env.GOOGLE_PRIVATE_KEY = 'test-key';
  JWT.prototype.getAccessToken = async function () { return { token: 'test-token' }; };
  const state = initialState(); state.budgets[0].label = '=IMPORTXML("example.invalid")'; const before = structuredClone(state);
  let batches = 0;
  globalThis.fetch = async (_url, init) => {
    if (!init?.body) return new Response(JSON.stringify({ sheets: [{ properties: { title: 'Existing financial data', sheetId: 17 } }] }));
    batches++;
    const requests = JSON.parse(String(init.body)).requests;
    assert.equal(requests.filter((r: any) => r.addSheet).length, 14);
    const newIds = new Set(requests.filter((r: any) => r.addSheet).map((r: any) => r.addSheet.properties.sheetId));
    assert.equal(newIds.size, 14); assert.equal(newIds.has(17), false);
    for (const request of requests) {
      if (request.addSheet) assert.match(request.addSheet.properties.title, /^CFT_/);
      else {
        assert.ok(request.updateCells); assert.ok(newIds.has(request.updateCells.start.sheetId));
        for (const row of request.updateCells.rows) for (const cell of row.values) assert.ok(!('formulaValue' in cell.userEnteredValue));
      }
    }
    return new Response(JSON.stringify({ replies: [] }));
  };
  try { const result = await exportSnapshot(state); assert.equal(result.tabs.length, 14); assert.equal(batches, 1); assert.deepEqual(state, before); }
  finally {
    globalThis.fetch = previousFetch; JWT.prototype.getAccessToken = previousToken;
    for (const [key, value] of Object.entries({ GOOGLE_SHEET_ID: env.id, GOOGLE_SERVICE_ACCOUNT_EMAIL: env.email, GOOGLE_PRIVATE_KEY: env.key })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
