import { JWT } from 'google-auth-library';
import { initialState } from '../shared/seed';
import type { State } from '../shared/model';

type Table = keyof State;
const headers: Record<Table, string[]> = {
  accounts: ['id', 'name', 'lastFour', 'scope', 'type', 'balanceCents', 'balanceUpdatedAt', 'balanceIncludedTransactionIds', 'balanceAsOf'],
  categories: ['id', 'name'],
  budgets: ['id', 'label', 'category', 'amountCents', 'scope', 'month'],
  income: ['id', 'label', 'amountCents', 'scope', 'month'],
  transactions: ['id', 'date', 'time', 'type', 'amountCents', 'category', 'subcategory', 'merchant', 'description', 'accountId', 'toAccountId', 'scope', 'classification', 'notes', 'createdAt', 'updatedAt', 'revision'],
  audit: ['id', 'entity', 'entityId', 'at', 'before', 'after'],
  notesReminders: ['id', 'title', 'note', 'category', 'relatedExpenseId', 'relatedAccountId', 'scope', 'priority', 'status', 'reminderDate', 'amountAffectedCents', 'previousCostCents', 'newCostCents', 'monthlySavingsCents', 'annualizedSavingsCents', 'createdAt', 'completedAt', 'updatedAt', 'revision'],
  dailyCheckIns: ['id', 'date', 'scope', 'confirmedAt', 'transactionFingerprint', 'revision', 'completed', 'completedAt', 'transactionsReviewed'],
  leakReviews: ['id', 'month', 'dismissedAt'],
  expenseFunding: ['id', 'budgetId', 'month', 'paymentAccountId', 'amountCents', 'dueDay', 'autopay', 'updatedAt', 'revision'],
  incomeSources: ['id', 'name', 'scope', 'category', 'defaultAccountId', 'updatedAt', 'revision'],
  settings: ['id', 'reminderTime', 'smallPurchaseThresholdCents', 'updatedAt', 'revision'],
  monthReviews: ['id', 'month', 'scope', 'note', 'nextMonth', 'createdAt', 'updatedAt', 'revision'],
};
const names = Object.keys(headers) as Table[];
const sheetName = (table: Table) => ({ notesReminders: 'Notes_Reminders', dailyCheckIns: 'Daily_Checkins', leakReviews: 'Leak_Reviews', expenseFunding: 'Expense_Funding', incomeSources: 'Income_Sources', settings: 'Settings', monthReviews: 'Month_Reviews' } as Partial<Record<Table, string>>)[table] ?? table;
const columnName = (table: Table, name: string) => !['accounts', 'categories', 'budgets', 'income', 'transactions', 'audit'].includes(table) ? name.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`) : name;
const sheetHeaders = (table: Table) => headers[table].map(name => columnName(table, name));
let ids: Partial<Record<Table, number>> = {};
let initialized: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
export const configured = () => Boolean(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
const client = () => new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
let auth: JWT | undefined;
async function request(path: string, body?: unknown): Promise<any> {
  auth ??= client();
  const token = await auth.getAccessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(process.env.GOOGLE_SHEET_ID!)}${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    console.error('Sheets request failed:', response.status);
    throw new Error('Google Sheets could not complete the request. Check the service account access and spreadsheet setup.');
  }
  return response.json();
}
function cells(values: unknown[]) {
  return { values: values.map(value => ({ userEnteredValue: typeof value === 'number' ? { numberValue: value } : typeof value === 'boolean' ? { boolValue: value } : { stringValue: value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value) } })) };
}
function append(table: Table, records: unknown[]) {
  return { appendCells: { sheetId: ids[table], fields: 'userEnteredValue', rows: records.map(record => cells(headers[table].map(h => (record as Record<string, unknown>)[h]))) } };
}
async function initialize() {
  const meta = await request('?fields=sheets.properties');
  for (const sheet of meta.sheets ?? []) {
    const table = names.find(table => sheetName(table) === sheet.properties.title);
    if (table) ids[table] = sheet.properties.sheetId;
  }
  const missing = names.filter(n => ids[n] === undefined);
  if (missing.length) {
    const result = await request(':batchUpdate', { requests: missing.map(table => ({ addSheet: { properties: { title: sheetName(table), gridProperties: { frozenRowCount: 1 } } } })) });
    result.replies.forEach((reply: any) => { const table = names.find(table => sheetName(table) === reply.addSheet.properties.title)!; ids[table] = reply.addSheet.properties.sheetId; });
  }
  const seed = initialState();
  const ranges = names.map(n => `ranges=${encodeURIComponent(`${sheetName(n)}!A1:Z1`)}`).join('&');
  const existing = await request(`/values:batchGet?${ranges}`);
  const writes: unknown[] = [];
  names.forEach((table, i) => {
    const row = existing.valueRanges[i]?.values?.[0] ?? [];
    const legacyLength = table === 'dailyCheckIns' ? 6 : table === 'accounts' ? 7 : 0;
    if (legacyLength && row.length === legacyLength && row.join('|') === sheetHeaders(table).slice(0, legacyLength).join('|')) {
      writes.push({ updateCells: { start: { sheetId: ids[table], rowIndex: 0, columnIndex: legacyLength }, fields: 'userEnteredValue', rows: [cells(sheetHeaders(table).slice(legacyLength))] } });
    } else if (row.length && row.join('|') !== sheetHeaders(table).join('|')) throw new Error(`The ${sheetName(table)} sheet has an incompatible header. Existing data has not been overwritten; review the header before retrying.`);
    if (!row.length) {
      writes.push({ appendCells: { sheetId: ids[table], fields: 'userEnteredValue', rows: [cells(sheetHeaders(table))] } });
      if (seed[table].length) writes.push(append(table, seed[table]));
    }
  });
  if (writes.length) await request(':batchUpdate', { requests: writes });
}
async function ready() {
  if (!configured()) throw new Error('Google Sheets is not configured.');
  initialized ??= initialize().catch(error => { initialized = undefined; throw error; });
  await initialized;
}
export async function readState(): Promise<State> {
  await ready();
  const ranges = names.map(n => `ranges=${encodeURIComponent(`${sheetName(n)}!A2:Z`)}`).join('&');
  const data = await request(`/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE`);
  const state: Record<string, unknown[]> = {};
  names.forEach((table, i) => {
    const rows = data.valueRanges[i]?.values ?? [];
    const records = rows.filter((row: unknown[]) => row[0]).map((row: unknown[]) => Object.fromEntries(headers[table].map((key, j) => {
      let value: unknown = row[j] ?? '';
      if (['amountCents', 'revision'].includes(key)) value = Number(value);
      if (key.endsWith('Cents') && key !== 'amountCents') value = value === '' ? null : Number(value);
      if ((key === 'balanceUpdatedAt' || key === 'balanceAsOf' || key === 'balanceIncludedTransactionIds' || key === 'completedAt') && value === '') value = null;
      if (key === 'dueDay') value = value === '' ? null : Number(value);
      if (key === 'transactionsReviewed') value = value === '' ? undefined : Number(value);
      if (key === 'autopay' || key === 'completed') value = value === '' && key === 'completed' ? undefined : value === true || value === 'true';
      if (key === 'before' || key === 'after') value = value ? JSON.parse(String(value)) : null;
      return [key, value];
    })));
    // Transactions, account changes, and monthly plans are append-only versions.
    // Resolve the latest record by stable ID, never by a client-supplied row number.
    if (table === 'dailyCheckIns') for (const record of records) { record.completed ??= true; record.completedAt ||= record.confirmedAt; record.transactionsReviewed ??= JSON.parse(String(record.transactionFingerprint)).length; }
    const latest = new Map<string, unknown>();
    for (const record of records) latest.set(String(record.id) + (table === 'budgets' || table === 'income' ? `:${record.month}` : ''), record);
    state[table] = Array.from(latest.values());
  });
  return state as unknown as State;
}
export async function writeRecords(writes: { table: Table; records: unknown[] }[]) {
  await ready();
  await request(':batchUpdate', { requests: writes.map(w => append(w.table, w.records)) });
}
// Run one server instance: Google Sheets does not offer compare-and-swap.
// Serializing writes prevents lost revisions between tabs in this instance.
export function mutate<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.catch(() => undefined);
  return result;
}
