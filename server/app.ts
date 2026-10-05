import 'dotenv/config';
import express from 'express';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backend, configured, mutate, readState, writeRecords, withCloudUser, cloudStore } from './storage';
import { authenticateFirebase, firebaseWebConfig, firestoreEnabled, validateFirebaseConfiguration } from './firebase';
import { reportsConfigured, exportSnapshot } from './sheets';
import { validateTransaction } from '../shared/model';
import { validateAction, validateCheckIn } from '../shared/actions';
import { balanceSnapshotIds, validSnapshot, validateFunding, validateIncomeSource, validateMonthReview, validateSettings } from '../shared/allocation';
import { validateReconciliation } from '../shared/reconciliation';
import { detectLeaks } from '../shared/leaks';

export function createApp({ hosted = process.env.VERCEL === '1' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '2mb' }));
  const production = process.env.NODE_ENV === 'production';
  const secret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
  let configurationError = '', allowedOrigin: string | undefined;
  try {
    if (hosted && !firestoreEnabled()) throw new Error('Set STORAGE_BACKEND=firestore in Vercel before opening the tracker.');
    if (hosted || process.env.APP_ORIGIN) {
      let address: URL;
      try { address = new URL(process.env.APP_ORIGIN || ''); } catch { throw new Error('Set APP_ORIGIN to the HTTPS website address.'); }
      if ((hosted && address.protocol !== 'https:') || !['http:', 'https:'].includes(address.protocol) || address.pathname !== '/' || address.search || address.hash || address.username || address.password) throw new Error('Set APP_ORIGIN to the website origin with no path.');
      allowedOrigin = address.origin;
    }
    validateFirebaseConfiguration();
    if (backend() === 'sheets' && (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) throw new Error('Set APP_PASSWORD and a SESSION_SECRET of at least 32 characters before using Google Sheets.');
  } catch (error) {
    if (!hosted) throw error;
    // Report incomplete hosting setup as JSON, without falling back to device mode.
    configurationError = 'Cloud setup is incomplete. Check the Vercel environment variables and Firebase service-account credential, then redeploy.';
  }
  const sign = (s: string) => createHmac('sha256', secret).update(s).digest('hex');
  const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  function signedIn(req: express.Request) {
    const cookie = req.headers.cookie?.split('; ').find(c => c.startsWith('cft_session='))?.slice(12) ?? '';
    const [expires, signature] = cookie.split('.');
    return Boolean(expires && signature && Number(expires) > Date.now() && equal(signature, sign(expires)));
  }
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (configurationError) { res.status(503).json({ error: configurationError }); return; }
    // JSON-only writes and same-origin checks guard against cross-site requests.
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (!req.is('application/json')) { res.status(415).json({ error: 'JSON is required.' }); return; }
      if (req.headers.origin && req.headers.origin !== (allowedOrigin ?? `${req.protocol}://${req.get('host')}`)) { res.status(403).json({ error: 'Request origin is not allowed.' }); return; }
    }
    next();
  });
  app.get('/api/status', async (req, res) => {
    let authenticated = signedIn(req);
    if (firestoreEnabled()) {
      authenticated = false;
      if (req.headers.authorization) try { await authenticateFirebase(req.headers.authorization); authenticated = true; } catch { /* Status never reveals token details. */ }
    }
    res.json({ configured: configured(), backend: backend(), authenticated, aiEnabled: Boolean(process.env.GEMINI_API_KEY), sheetsExportEnabled: firestoreEnabled() && reportsConfigured(), firebase: firestoreEnabled() ? firebaseWebConfig() : undefined });
  });
  const attempts = new Map<string, { count: number; until: number }>();
  app.post('/api/login', (req, res) => {
    if (firestoreEnabled()) { res.status(409).json({ error: 'Use Google sign-in for Firestore.' }); return; }
    const ip = req.ip ?? 'local';
    const entry = attempts.get(ip);
    if (entry && entry.until > Date.now() && entry.count >= 10) { res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' }); return; }
    const password = req.body?.password;
    if (!process.env.APP_PASSWORD || typeof password !== 'string' || !equal(sign(password), sign(process.env.APP_PASSWORD))) {
      attempts.set(ip, { count: entry && entry.until > Date.now() ? entry.count + 1 : 1, until: Date.now() + 900000 });
      res.status(401).json({ error: 'That password did not match.' }); return;
    }
    attempts.delete(ip);
    const expires = String(Date.now() + 12 * 60 * 60 * 1000);
    res.cookie('cft_session', `${expires}.${sign(expires)}`, { httpOnly: true, sameSite: 'strict', secure: production, maxAge: 12 * 60 * 60 * 1000, path: '/' });
    res.json({ ok: true });
  });
  app.post('/api/logout', (_req, res) => { res.clearCookie('cft_session', { path: '/' }); res.json({ ok: true }); });
  app.use('/api', async (req, res, next) => {
    if (!configured()) { res.status(503).json({ error: 'Cloud storage is not configured.' }); return; }
    if (firestoreEnabled()) {
      try {
        const uid = await authenticateFirebase(req.headers.authorization);
        withCloudUser(uid, next);
      } catch { res.status(401).json({ error: 'Please sign in with the owner’s Google account.' }); }
      return;
    }
    if (!signedIn(req)) { res.status(401).json({ error: 'Please sign in again.' }); return; }
    next();
  });
  app.get('/api/cloud/info', async (_req, res) => {
    if (!firestoreEnabled()) { res.status(409).json({ error: 'Firestore is not enabled.' }); return; }
    res.json(await cloudStore().info());
  });
  app.post('/api/cloud/import', async (req, res) => {
    if (!firestoreEnabled()) { res.status(409).json({ error: 'Firestore is not enabled.' }); return; }
    if (req.body?.confirmed !== true) throw new Error('Review your backup and confirm the import first.');
    res.json(await cloudStore().initialize(req.body.state));
  });
  app.post('/api/sheets/export', async (_req, res) => {
    if (!firestoreEnabled()) { res.status(409).json({ error: 'Snapshot exports require Firestore storage.' }); return; }
    res.json(await exportSnapshot(await readState()));
  });
  app.get('/api/state', async (_req, res) => res.json(await readState()));
  app.post('/api/transactions', async (req, res) => {
    const result = await mutate(async () => {
      const state = await readState();
      const previous = state.transactions.find(t => t.id === req.body?.id);
      if (previous && !req.body?.revision) throw new Error('Transaction already exists.');
      const transaction = validateTransaction(req.body, state, previous);
      const audit = { id: randomUUID(), entity: 'transaction', entityId: transaction.id, at: transaction.updatedAt, before: previous ?? null, after: transaction };
      await writeRecords([{ table: 'transactions', records: [transaction] }, { table: 'audit', records: [audit] }]);
      return transaction;
    });
    res.json(result);
  });
  app.post('/api/accounts/:id/balance', async (req, res) => {
    const result = await mutate(async () => {
      const state = await readState();
      const before = state.accounts.find(a => a.id === req.params.id);
      if (!before) throw new Error('Account was not found.');
      const balance = req.body?.balanceCents;
      if (!Number.isSafeInteger(balance) || Math.abs(balance) > 99999999999) throw new Error('Enter a valid balance in cents.');
      const asOf = req.body.balanceAsOf ?? null;
      if (asOf !== null && !validSnapshot(asOf)) throw new Error('Choose a valid date and time for this balance snapshot.');
      const after = { ...before, balanceAsOf: asOf, balanceIncludedTransactionIds: asOf === null ? null : balanceSnapshotIds(state.transactions, asOf), balanceCents: balance, balanceUpdatedAt: new Date().toISOString() };
      await writeRecords([{ table: 'accounts', records: [after] }, { table: 'audit', records: [{ id: randomUUID(), entity: 'account', entityId: after.id, at: after.balanceUpdatedAt, before, after }] }]);
      return after;
    });
    res.json(result);
  });
  app.post('/api/budgets/:id', async (req, res) => {
    const result = await mutate(async () => {
      const state = await readState();
      const before = state.budgets.find(b => b.id === req.params.id && b.month === req.body?.month) ?? state.budgets.find(b => b.id === req.params.id && b.month === '*');
      if (!before) throw new Error('Budget was not found.');
      const { amountCents, month } = req.body;
      if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > 99999999999 || typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Enter a valid monthly budget.');
      const after = { ...before, amountCents, month };
      await writeRecords([{ table: 'budgets', records: [after] }, { table: 'audit', records: [{ id: randomUUID(), entity: 'budget', entityId: after.id, at: new Date().toISOString(), before, after }] }]);
      return after;
    });
    res.json(result);
  });
  app.post('/api/actions', async (req, res) => {
    const result = await mutate(async () => {
      const state = await readState(), before = state.notesReminders.find(a => a.id === req.body?.id);
      const after = validateAction(req.body, state, before);
      await writeRecords([{ table: 'notesReminders', records: [after] }, { table: 'audit', records: [{ id: randomUUID(), entity: 'financial action', entityId: after.id, at: after.updatedAt, before: before ?? null, after }] }]);
      return after;
    });
    res.json(result);
  });
  app.post('/api/check-ins', async (req, res) => {
    const result = await mutate(async () => {
      const state = await readState(), after = validateCheckIn(req.body, state), before = state.dailyCheckIns.find(c => c.id === after.id);
      await writeRecords([{ table: 'dailyCheckIns', records: [after] }, { table: 'audit', records: [{ id: randomUUID(), entity: 'daily check-in', entityId: after.id, at: after.confirmedAt, before: before ?? null, after }] }]);
      return after;
    });
    res.json(result);
  });
  app.post('/api/leak-reviews', async (req, res) => {
    const result = await mutate(async () => {
      const state = await readState();
      const before = state.leakReviews.find(r => r.id === req.body?.id);
      if (before) return before;
      if (typeof req.body?.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(req.body.month)) throw new Error('Choose a valid review month.');
      const leak = detectLeaks(state, req.body.month, 'All').find(l => l.id === req.body.id);
      if (!leak) throw new Error('This review has changed. Refresh before dismissing.');
      const after = { id: leak.id, month: leak.month, dismissedAt: new Date().toISOString() };
      await writeRecords([{ table: 'leakReviews', records: [after] }, { table: 'audit', records: [{ id: randomUUID(), entity: 'leak review', entityId: after.id, at: after.dismissedAt, before: null, after }] }]);
      return after;
    });
    res.json(result);
  });
  const extensions = { 'balance-reconciliations': { table: 'balanceReconciliations', validate: validateReconciliation }, 'expense-funding': { table: 'expenseFunding', validate: validateFunding }, 'income-sources': { table: 'incomeSources', validate: validateIncomeSource }, settings: { table: 'settings', validate: validateSettings }, 'month-reviews': { table: 'monthReviews', validate: validateMonthReview } } as const;
  for (const [route, extension] of Object.entries(extensions)) app.post(`/api/${route}`, async (req, res) => {
    const result = await mutate(async () => {
      const state = await readState(), after = extension.validate(req.body, state);
      const before = state[extension.table].find(r => r.id === after.id) ?? null;
      await writeRecords([{ table: extension.table, records: [after] }, { table: 'audit', records: [{ id: randomUUID(), entity: route, entityId: after.id, at: after.updatedAt, before, after }] }]);
      return after;
    });
    res.json(result);
  });
  app.post('/api/ai/draft', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) { res.status(503).json({ error: 'Gemini is not configured. Use the quick-entry form.' }); return; }
    if (typeof req.body?.text !== 'string' || !req.body.text.trim() || req.body.text.length > 2000) throw new Error('Enter a description of up to 2,000 characters.');
    const state = await readState();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.5-flash')}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `Interpret a transaction as a DRAFT. Never invent missing amounts, merchants, accounts, dates or classifications. Return JSON: type (Expense/Income/Transfer), amount (a dollar string with 2 decimals), merchant, category, subcategory, accountId, toAccountId, classification (Need/Want), scope (Personal/Business, independent of the account), date, time, notes, uncertainties (array of strings). Omit unknown fields and list them in uncertainties. Today's local date: ${req.body.date}. Categories: ${JSON.stringify(state.categories)}. Accounts: ${JSON.stringify(state.accounts.map(({ id, name, lastFour, scope }) => ({ id, name, lastFour, scope })))}. Budget items: ${JSON.stringify(state.budgets.map(({ label, category }) => ({ label, category })))}.` }] },
        contents: [{ role: 'user', parts: [{ text: req.body.text }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Gemini could not create a draft. You can still enter the transaction manually.');
    const data: any = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    if (!content) throw new Error('Gemini did not return a draft.');
    res.json(JSON.parse(content)); // This route never writes financial records.
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));
  if (!hosted) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    app.use(express.static(path.join(root, 'dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  }
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error.message);
    res.status(400).json({ error: error.message || 'The request could not be completed.' });
  });
  return app;
}
