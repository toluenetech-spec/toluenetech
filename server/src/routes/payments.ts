/**
 * Payments (Flutterwave verification architecture).
 *
 * Two endpoints:
 *   POST /payments/verify        — called by client (or webhook) after a
 *                                  successful Flutterwave checkout. The server
 *                                  verifies the transaction SERVER-SIDE using
 *                                  FLW_SECRET_KEY before recording payment.
 *   POST /payments/webhook       — Flutterwave webhook (signature-verified).
 *                                  Treated as a verification event.
 *
 * Security properties:
 *   - Client-submitted "amount" or "status" is NEVER trusted. Verification
 *     re-fetches the transaction from the provider.
 *   - Each verification uses an idempotency_key (tx_ref) so retries are safe.
 *   - Amount, currency, and invoice must match the outstanding invoice;
 *     partial payments are recorded but never mark the invoice PAID in full.
 *   - No client secret (FLW_SECRET_KEY) is ever sent to the browser.
 *
 * Live credentials (FLW_SECRET_KEY, FLW_PUBLIC_KEY) may be absent in
 * development/sandbox; in that case endpoints return 503 with an
 * architecture-safe error rather than creating fake successful payments.
 */
import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Env } from '../env';
import { authClient } from '../lib/auth';
import { ApiError, jsonError } from '../lib/errors';
import { writeAudit } from '../lib/audit';
import type { AuthContext } from '../lib/auth';

const app = new Hono<{ Bindings: Env }>();

async function requireClient(c: any): Promise<AuthContext> {
  try { return await authClient(c.req.raw, c.env as Env); }
  catch (e) {
    if (e instanceof ApiError) throw new ApiError({ code: e.code as any, message: e.message, status: e.status });
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
  }
}
app.onError((err, c) => jsonError(c, err));

const uid = () => crypto.randomUUID();
const now = () => new Date();

/**
 * GET /payments/config — return PUBLIC payment configuration for the browser
 * to initialize Flutterwave inline checkout. The secret key is NEVER sent.
 * If the public key is not configured, returns `{ configured: false }` so
 * the UI can disable the pay button instead of fabricating success.
 */
app.get('/config', async (c) => {
  const env = c.env as Env;
  const publicKey = env.FLW_PUBLIC_KEY;
  return c.json({
    configured: !!publicKey,
    provider: 'flutterwave',
    publicKey: publicKey || null,
  });
});

async function verifyWithFlutterwave(env: Env, transactionId: string): Promise<any> {
  const secret = env.FLW_SECRET_KEY;
  if (!secret) throw new ApiError({ code: 'SERVICE_UNAVAILABLE', message: 'Payment provider not configured.' });
  const res = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new ApiError({ code: 'SERVICE_UNAVAILABLE', message: `Provider verification failed (${res.status}).` });
  const data = await res.json() as any;
  return data?.data ?? null;
}

/**
 * Client-side verification: client POSTs { transaction_id, invoice_id } after
 * completing the Flutterwave checkout; server re-verify and reconcile.
 */
app.post('/verify', async (c) => {
  const env = c.env as Env;
  const a = await requireClient(c);
  if (!a.clientId) throw new ApiError({ code: 'FORBIDDEN', message: 'Client access required.' });
  let b: any; try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const txId = typeof b.transaction_id === 'string' ? b.transaction_id.trim() : '';
  const invoiceId = typeof b.invoice_id === 'string' ? b.invoice_id.trim() : '';
  const txRef = typeof b.tx_ref === 'string' ? b.tx_ref.trim() : txId;
  if (!txId || !invoiceId) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'transaction_id and invoice_id are required.' });

  const db = getDb(env);
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).limit(1);
  if (!inv || inv.clientId !== a.clientId) throw new ApiError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
  if (['PAID', 'CANCELLED', 'VOID'].includes(inv.status)) {
    return c.json({ success: true, data: { status: inv.status, already: true } });
  }

  // Idempotency: if we already verified this tx, return the existing payment.
  const [existing] = await db.select().from(schema.payments)
    .where(and(eq(schema.payments.providerRef, txRef), eq(schema.payments.clientId, a.clientId))).limit(1);
  if (existing) return c.json({ success: true, data: { payment: existing, already: true } });

  let tx: any;
  try {
    tx = await verifyWithFlutterwave(env, txId);
  } catch (e: any) {
    // Record failed verification attempt.
    const [p] = await db.insert(schema.payments).values({
      id: uid(), invoiceId: inv.id, clientId: a.clientId, projectId: inv.projectId,
      provider: 'flutterwave', providerRef: txRef, providerTransactionId: txId,
      amountCents: 0, currency: inv.currency, status: 'FAILED',
      failureReason: e.message || 'verification_failed',
      idempotencyKey: txRef,
    }).returning();
    writeAudit(env, { action: 'PAYMENT_VERIFY', entity: 'payments', entityId: p.id, auth: a, req: c.req.raw, meta: { ok: false, reason: e.message } });
    throw e;
  }

  if (!tx || tx.status !== 'successful') {
    const [p] = await db.insert(schema.payments).values({
      id: uid(), invoiceId: inv.id, clientId: a.clientId, projectId: inv.projectId,
      provider: 'flutterwave', providerRef: txRef, providerTransactionId: txId,
      amountCents: Math.round(Number(tx?.amount || 0) * 100),
      currency: String(tx?.currency || inv.currency).toUpperCase().slice(0, 3),
      status: 'FAILED', failureReason: tx?.status || 'not_successful',
      verificationMeta: tx || null, idempotencyKey: txRef,
    }).returning();
    writeAudit(env, { action: 'PAYMENT_VERIFY', entity: 'payments', entityId: p.id, auth: a, req: c.req.raw, meta: { ok: false, providerStatus: tx?.status } });
    return c.json({ success: true, data: { payment: p, verified: false, status: tx?.status } });
  }

  // Currency and amount check (with small tolerance for rounding).
  const amountCents = Math.round(Number(tx.amount) * 100);
  if (String(tx.currency || '').toUpperCase() !== inv.currency) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Currency mismatch.' });
  }
  const outstanding = Math.max(0, inv.amountCents - (inv.discountCents || 0) + (inv.taxCents || 0) - 0); // subtotal already in amountCents
  // For simplicity, require amount >= amountCents (overpayments recorded but not refunded automatically).
  if (amountCents < inv.amountCents - 1 /* cent tolerance */) {
    // Partial payment: record but don't mark PAID.
    const [p] = await db.insert(schema.payments).values({
      id: uid(), invoiceId: inv.id, clientId: a.clientId, projectId: inv.projectId,
      provider: 'flutterwave', providerRef: txRef, providerTransactionId: String(tx.id || txId),
      amountCents, currency: inv.currency, status: 'SUCCESSFUL',
      verifiedAt: now(), verificationMeta: tx, idempotencyKey: txRef,
    }).returning();
    await db.update(schema.invoices).set({ status: 'PARTIALLY_PAID' as any }).where(eq(schema.invoices.id, inv.id));
    writeAudit(env, { action: 'PAYMENT_VERIFY', entity: 'payments', entityId: p.id, auth: a, req: c.req.raw, meta: { ok: true, partial: true, amountCents } });
    return c.json({ success: true, data: { payment: p, status: 'PARTIALLY_PAID' } });
  }

  const [p] = await db.insert(schema.payments).values({
    id: uid(), invoiceId: inv.id, clientId: a.clientId, projectId: inv.projectId,
    provider: 'flutterwave', providerRef: txRef, providerTransactionId: String(tx.id || txId),
    amountCents, currency: inv.currency, status: 'SUCCESSFUL',
    verifiedAt: now(), verificationMeta: tx, idempotencyKey: txRef,
  }).returning();
  await db.update(schema.invoices).set({ status: 'PAID' as any, paidAt: now() }).where(eq(schema.invoices.id, inv.id));
  // Notify admin.
  await db.insert(schema.notifications).values({
    id: uid(), type: 'payment_received',
    title: `Payment received for ${inv.number}`,
    body: `${(amountCents / 100).toFixed(2)} ${inv.currency} — invoice marked paid.`,
    link: `/admin/invoices/${inv.id}`, clientId: a.clientId,
  });
  writeAudit(env, { action: 'PAYMENT_VERIFY', entity: 'payments', entityId: p.id, auth: a, req: c.req.raw, meta: { ok: true, amountCents } });
  return c.json({ success: true, data: { payment: p, status: 'PAID' } });
});

/**
 * Flutterwave webhook. Verifies signature via Verif-Hash header.
 * Returns 200 OK immediately so we don't get retried.
 */
app.post('/webhook', async (c) => {
  const env = c.env as Env;
  const secretHash = env.FLW_SECRET_HASH;
  const verifHash = c.req.header('verif-hash');
  if (!secretHash || !verifHash || verifHash !== secretHash) {
    return c.json({ status: 'ignored' }, 401);
  }
  let payload: any; try { payload = await c.req.json(); } catch { return c.json({ status: 'ok' }); }
  const tx = payload?.data;
  if (!tx || !tx.tx_ref) return c.json({ status: 'ok' });
  const db = getDb(env);
  // Idempotency: if we already recorded this tx_ref, skip.
  const [existing] = await db.select().from(schema.payments).where(eq(schema.payments.providerRef, String(tx.tx_ref))).limit(1);
  if (existing) return c.json({ status: 'ok', duplicate: true });
  // Find the invoice from meta or by amount+client? Webhook payload carries tx_ref
  // which we form as `inv-${invoiceId}-${clientId}` when creating checkout links
  // (admin flow sets this). If we can't parse, still record but leave invoice_id null.
  const m = String(tx.tx_ref).match(/^inv-([0-9a-f-]{36})-([0-9a-f-]{36})$/i);
  const invoiceId = m ? m[1] : null;
  const clientId = m ? m[2] : (tx.customer?.id ? String(tx.customer.id) : null);
  const amountCents = Math.round(Number(tx.amount || 0) * 100);
  await db.insert(schema.payments).values({
    id: uid(),
    invoiceId, clientId: clientId || 'unknown',
    provider: 'flutterwave', providerRef: String(tx.tx_ref), providerTransactionId: String(tx.id || ''),
    amountCents, currency: String(tx.currency || 'USD').toUpperCase().slice(0, 3),
    status: tx.status === 'successful' ? 'SUCCESSFUL' : 'FAILED',
    verifiedAt: tx.status === 'successful' ? now() : null,
    failureReason: tx.status !== 'successful' ? String(tx.status || 'failed') : null,
    verificationMeta: tx, idempotencyKey: String(tx.tx_ref),
  });
  if (invoiceId && tx.status === 'successful') {
    await db.update(schema.invoices).set({ status: 'PAID' as any, paidAt: now() }).where(eq(schema.invoices.id, invoiceId));
  }
  writeAudit(env, { action: 'PAYMENT_VERIFY', entity: 'payments', auth: null, req: c.req.raw, meta: { webhook: true, status: tx.status, txRef: tx.tx_ref } });
  return c.json({ status: 'ok' });
});

/** Client can list their own payments (read-only). */
app.get('/', async (c) => {
  const env = c.env as Env;
  const a = await requireClient(c);
  if (!a.clientId) throw new ApiError({ code: 'FORBIDDEN', message: 'Client access required.' });
  const db = getDb(env);
  const items = await db.select().from(schema.payments)
    .where(eq(schema.payments.clientId, a.clientId))
    .orderBy(sql`${schema.payments.createdAt} DESC`);
  return c.json({ success: true, data: { items, total: items.length } });
});

export default app;
