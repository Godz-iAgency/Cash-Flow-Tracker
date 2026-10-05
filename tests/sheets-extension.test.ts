import test from 'node:test';
import assert from 'node:assert/strict';
import { JWT } from 'google-auth-library';
import { initialState } from '../shared/seed';
import { validateTransaction } from '../shared/model';
import { validateFunding, validateMonthReview, validateSettings } from '../shared/allocation';
import { validateReconciliation, reconciliationFingerprint } from '../shared/reconciliation';
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
  const transaction = validateTransaction({ id: 'existing-transaction', date: '2026-10-03', time: '12:00', type: 'Expense', amountCents: 10, category: 'Food', subcategory: 'Grocery', merchant: 'Existing purchase', description: '', accountId: 'capital-one-checking', toAccountId: '', classification: 'Need', scope: 'Personal', notes: '' }, seed);
  seed.transactions = [transaction];
  const sheets = new Map<string, { id: number; rows: unknown[][] }>();
  Object.entries(oldHeaders).forEach(([name, headers], i) => {
    const records = seed[name as keyof typeof oldHeaders] as unknown as Record<string, unknown>[];
    sheets.set(name, { id: i + 1, rows: [headers, ...records.map(record => headers.map(header => record[header] ?? ''))] });
  });
  sheets.set('Daily_Checkins', { id: 7, rows: [['id', 'date', 'scope', 'confirmed_at', 'transaction_fingerprint', 'revision'], ['2026-10-01-All', '2026-10-01', 'All', '2026-10-01T20:00:00Z', '[]', 1]] });
  const before = structuredClone([...sheets.entries()].filter(([name]) => name in oldHeaders));
  const oldCheckInRow = structuredClone(sheets.get('Daily_Checkins')!.rows[1]);
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
          assert.ok(['Notes_Reminders', 'Daily_Checkins', 'Leak_Reviews', 'Expense_Funding', 'Income_Sources', 'Settings', 'Month_Reviews', 'Balance_Reconciliations'].includes(title));
          const id = sheets.size + 1; sheets.set(title, { id, rows: [] });
          replies.push({ addSheet: { properties: { title, sheetId: id } } });
        } else if (request.updateCells) {
          const start = request.updateCells.start, sheet = [...sheets.values()].find(s => s.id === start.sheetId)!;
          assert.equal(start.rowIndex, 0); assert.ok((start.sheetId === 1 && start.columnIndex === 7) || (start.sheetId === 7 && start.columnIndex === 6) || (start.sheetId === 5 && start.columnIndex === 17));
          sheet.rows[0].push(...request.updateCells.rows[0].values.map((cell: any) => cell.userEnteredValue.stringValue)); replies.push({});
        } else if (request.appendCells) {
          const sheet = [...sheets.values()].find(sheet => sheet.id === request.appendCells.sheetId)!;
          for (const row of request.appendCells.rows) sheet.rows.push(row.values.map((cell: any) => {
            assert.ok(!('formulaValue' in cell.userEnteredValue));
            return cell.userEnteredValue.numberValue ?? cell.userEnteredValue.boolValue ?? cell.userEnteredValue.stringValue;
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
    for (const [name, original] of before) { const after = sheets.get(name)!; assert.deepEqual(after.rows.slice(1), original.rows.slice(1)); assert.deepEqual(after.rows[0].slice(0, original.rows[0].length), original.rows[0]); }
    assert.deepEqual(sheets.get('Daily_Checkins')!.rows[1], oldCheckInRow);
    assert.equal(sheets.get('accounts')!.rows[0][7], 'balanceIncludedTransactionIds');
    assert.equal(sheets.get('transactions')!.rows[0][17], 'voided');
    assert.deepEqual(sheets.get('Daily_Checkins')!.rows[0].slice(6), ['completed', 'completed_at', 'transactions_reviewed']);
    assert.deepEqual(state.transactions, [transaction]); assert.equal(state.accounts[3].lastFour, '0366');
    assert.deepEqual(state.notesReminders, []); assert.equal(state.dailyCheckIns[0].completed, true); assert.equal(state.dailyCheckIns[0].transactionsReviewed, 0); assert.deepEqual(state.leakReviews, []);
    assert.ok(sheets.get('Notes_Reminders')!.rows[0].includes('amount_affected_cents'));
    assert.ok(sheets.get('Notes_Reminders')!.rows[0].includes('annualized_savings_cents'));
    assert.deepEqual(state.balanceReconciliations, []);
    assert.deepEqual(sheets.get('Balance_Reconciliations')!.rows[0], ['id', 'account_id', 'account_type', 'as_of', 'actual_balance_cents', 'opening_balance_cents', 'opening_as_of', 'money_in_cents', 'money_out_cents', 'calculated_balance_cents', 'difference_cents', 'ledger_fingerprint', 'note', 'created_at', 'updated_at', 'revision']);
    const comparison = validateReconciliation({ id: 'comparison-1', accountId: state.accounts[0].id, asOf: '2026-10-03T12:00', actualBalanceCents: 12345, note: '=A1', ledgerFingerprint: reconciliationFingerprint(state, state.accounts[0], '2026-10-03T12:00') }, state, '2026-10-03T12:00');
    await writeRecords([{ table: 'balanceReconciliations', records: [comparison] }, { table: 'audit', records: [{ id: 'compare-audit', entity: 'balance-reconciliations', entityId: comparison.id, at: comparison.createdAt, before: null, after: comparison }] }]);
    assert.equal(batches.at(-1)!.length, 2);
    const compared = await readState();
    assert.deepEqual(compared.balanceReconciliations, [comparison]); assert.deepEqual(compared.transactions, state.transactions); assert.deepEqual(compared.accounts, state.accounts);
    assert.equal(compared.balanceReconciliations[0].calculatedBalanceCents, null); assert.equal(compared.balanceReconciliations[0].differenceCents, null);
    const action = validateAction({ id: 'action-1', title: '=A1', note: 'A literal financial note', category: 'Negotiation', priority: 'High', status: 'Open', scope: 'Personal', relatedExpenseId: '', relatedAccountId: '', reminderDate: '', previousCostCents: 9000, newCostCents: 7000, amountAffectedCents: null, monthlySavingsCents: null }, state);
    const audit = { id: 'audit-1', entity: 'financial action', entityId: action.id, at: action.updatedAt, before: null, after: action };
    await writeRecords([{ table: 'notesReminders', records: [action] }, { table: 'audit', records: [audit] }]);
    assert.equal(batches.at(-1)!.length, 2);
    const after = await readState(); assert.deepEqual(after.notesReminders, [action]); assert.deepEqual(after.audit, [...compared.audit, audit]);
    const completed = validateAction({ ...action, status: 'Completed' }, after, action);
    await writeRecords([{ table: 'notesReminders', records: [completed] }]);
    assert.equal(sheets.get('Notes_Reminders')!.rows.length, 3);
    assert.deepEqual((await readState()).notesReminders, [completed]);
    assert.deepEqual((await readState()).transactions, [transaction]);
    const funding = validateFunding({ budgetId: state.budgets[0].id, month: '*', paymentAccountId: 'chase-savings', amountCents: 121000, dueDay: null, autopay: true, revision: 0 }, after);
    const settings = validateSettings({ reminderTime: '19:45', smallPurchaseThresholdCents: 500, revision: 0 }, after);
    const review = validateMonthReview({ month: '2026-10', scope: 'All', note: 'Review funding next month.', revision: 0 }, after);
    await writeRecords([{ table: 'expenseFunding', records: [funding] }, { table: 'settings', records: [settings] }, { table: 'monthReviews', records: [review] }]);
    const extended = await readState(); assert.deepEqual(extended.expenseFunding, [funding]); assert.deepEqual(extended.settings, [settings]); assert.deepEqual(extended.monthReviews, [review]);
    for (const [name, original] of before) if (name !== 'audit') { assert.deepEqual(sheets.get(name)!.rows.slice(1), original.rows.slice(1)); assert.deepEqual(sheets.get(name)!.rows[0].slice(0, original.rows[0].length), original.rows[0]); }
  } finally {
    globalThis.fetch = originalFetch; JWT.prototype.getAccessToken = originalToken;
    for (const [key, value] of Object.entries({ GOOGLE_SHEET_ID: originalEnv.id, GOOGLE_SERVICE_ACCOUNT_EMAIL: originalEnv.email, GOOGLE_PRIVATE_KEY: originalEnv.key })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
