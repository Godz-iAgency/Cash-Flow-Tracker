import test from 'node:test';
import assert from 'node:assert/strict';
import { JWT } from 'google-auth-library';
import { initialState } from '../shared/seed';
import { validateTransaction } from '../shared/model';
import { validateAction } from '../shared/actions';

test('Sheets extension adds only new tabs and preserves existing schemas, records, and append-only history', async () => {
  const oldHeaders = {
    accounts: ['id', 'name', 'lastFour', 'scope', 'type', 'balanceCents', 'balanceUpdatedAt'],
    categories: ['id', 'name'],
    budgets: ['id', 'label', 'category', 'amountCents', 'scope', 'month'],
    income: ['id', 'label', 'amountCents', 'scope', 'month'],
    transactions: ['id', 'date', 'time', 'type', 'amountCents', 'category', 'subcategory', 'merchant', 'description', 'accountId', 'toAccountId', 'scope', 'classification', 'notes', 'createdAt', 'updatedAt', 'revision'],
    audit: ['id', 'entity', 'entityId', 'at', 'before', 'after'],
  };
  const seed = initialState();
  const transaction = validateTransaction({ id: 'existing-transaction', date: '2026-10-03', time: '12:00', type: 'Expense', amountCents: 10, category: 'Food', subcategory: 'Grocery', merchant: 'Existing purchase', description: '', accountId: 'capital-one-checking', toAccountId: '', classification: 'Need', notes: '' }, seed);
  seed.transactions = [transaction];
  const sheets = new Map<string, { id: number; rows: unknown[][] }>();
  Object.entries(oldHeaders).forEach(([name, headers], i) => {
    const records = seed[name as keyof typeof oldHeaders] as unknown as Record<string, unknown>[];
    sheets.set(name, { id: i + 1, rows: [headers, ...records.map(record => headers.map(header => record[header] ?? ''))] });
  });
  const before = structuredClone([...sheets.entries()]);
  const originalFetch = globalThis.fetch, originalToken = JWT.prototype.getAccessToken;
  const originalEnv = { id: process.env.GOOGLE_SHEET_ID, email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY };
  process.env.GOOGLE_SHEET_ID = 'test-only-sheet'; process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.invalid'; process.env.GOOGLE_PRIVATE_KEY = 'test-only-key';
  JWT.prototype.getAccessToken = async function () { return { token: 'test-only-token' }; };
  const batches: any[][] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.host, 'sheets.googleapis.com');
    assert.ok(url.pathname.includes('test-only-sheet'));
    let body: unknown;
    if (init?.method === 'POST') {
      const requests = JSON.parse(String(init.body)).requests;
      batches.push(requests);
      const replies = [];
      for (const request of requests) {
        if (request.addSheet) {
          const title = request.addSheet.properties.title;
          assert.ok(['Notes_Reminders', 'Daily_Checkins', 'Leak_Reviews'].includes(title));
          const id = sheets.size + 1; sheets.set(title, { id, rows: [] });
          replies.push({ addSheet: { properties: { title, sheetId: id } } });
        } else if (request.appendCells) {
          const sheet = [...sheets.values()].find(sheet => sheet.id === request.appendCells.sheetId)!;
          for (const row of request.appendCells.rows) sheet.rows.push(row.values.map((cell: any) => {
            assert.ok(!('formulaValue' in cell.userEnteredValue));
            return cell.userEnteredValue.numberValue ?? cell.userEnteredValue.stringValue;
          }));
          replies.push({});
        } else assert.fail('Unexpected Sheets mutation');
      }
      body = { replies };
    } else if (url.pathname.endsWith('/values:batchGet')) {
      body = { valueRanges: url.searchParams.getAll('ranges').map(range => {
        const [name, cells] = range.split('!'); const sheet = sheets.get(name)!;
        return { values: cells.startsWith('A1:') ? [sheet.rows[0] ?? []] : sheet.rows.slice(1) };
      }) };
    } else body = { sheets: [...sheets.entries()].map(([title, sheet]) => ({ properties: { title, sheetId: sheet.id } })) };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const { readState, writeRecords } = await import('../server/sheets');
    const state = await readState();
    assert.deepEqual([...sheets.entries()].filter(([name]) => name in oldHeaders), before);
    assert.deepEqual(state.transactions, [transaction]); assert.equal(state.accounts[3].lastFour, '0366');
    assert.deepEqual(state.notesReminders, []); assert.deepEqual(state.dailyCheckIns, []); assert.deepEqual(state.leakReviews, []);
    assert.ok(sheets.get('Notes_Reminders')!.rows[0].includes('amount_affected_cents'));
    assert.ok(sheets.get('Notes_Reminders')!.rows[0].includes('annualized_savings_cents'));
    const action = validateAction({ id: 'action-1', title: '=A1', note: 'A literal financial note', category: 'Negotiation', priority: 'High', status: 'Open', scope: 'Personal', relatedExpenseId: '', relatedAccountId: '', reminderDate: '', previousCostCents: 9000, newCostCents: 7000, amountAffectedCents: null, monthlySavingsCents: null }, state);
    const audit = { id: 'audit-1', entity: 'financial action', entityId: action.id, at: action.updatedAt, before: null, after: action };
    await writeRecords([{ table: 'notesReminders', records: [action] }, { table: 'audit', records: [audit] }]);
    assert.equal(batches.at(-1)!.length, 2);
    const after = await readState(); assert.deepEqual(after.notesReminders, [action]); assert.deepEqual(after.audit, [audit]);
    const completed = validateAction({ ...action, status: 'Completed' }, after, action);
    await writeRecords([{ table: 'notesReminders', records: [completed] }]);
    assert.equal(sheets.get('Notes_Reminders')!.rows.length, 3);
    assert.deepEqual((await readState()).notesReminders, [completed]);
    assert.deepEqual((await readState()).transactions, [transaction]);
    for (const [name, original] of before) if (name !== 'audit') assert.deepEqual(sheets.get(name), original);
  } finally {
    globalThis.fetch = originalFetch; JWT.prototype.getAccessToken = originalToken;
    for (const [key, value] of Object.entries({ GOOGLE_SHEET_ID: originalEnv.id, GOOGLE_SERVICE_ACCOUNT_EMAIL: originalEnv.email, GOOGLE_PRIVATE_KEY: originalEnv.key })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
