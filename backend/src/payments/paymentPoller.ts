/**
 * Payment Poller — background job that auto-resolves pending STK push payments.
 *
 * Two modes:
 *  1. DARAJA_SANDBOX_AUTO_COMPLETE=true  → immediately marks all AWAITING properties as PAID
 *  2. Real sandbox / production          → queries Safaricom every 30s and updates on result
 */
import { db } from '../database/connection';
import { darajaClient } from '../services/daraja';
import logger from '../utils/logger';

const POLL_INTERVAL_MS = 30_000;
const isProduction = process.env.NODE_ENV === 'production';
const sandboxAutoComplete = process.env.DARAJA_SANDBOX_AUTO_COMPLETE === 'true' && !isProduction;

if (process.env.DARAJA_SANDBOX_AUTO_COMPLETE === 'true' && isProduction) {
  // Log a loud warning — never silently auto-complete payments in production
  console.error('[PaymentPoller] CRITICAL: DARAJA_SANDBOX_AUTO_COMPLETE=true is set in a production environment. This flag is IGNORED in production to prevent fraudulent payment completions. Remove it from your production environment variables immediately.');
}

// ── Auto-complete: mark all AWAITING properties as PAID immediately ───────────
async function autoCompleteAll(): Promise<void> {
  try {
    const rows = await db.query(
      `SELECT id, property_name FROM marketer_properties
       WHERE payment_status = 'AWAITING_CONFIRMATION'`
    );
    if (!rows.rows.length) return;

    logger.info(`[PaymentPoller] SANDBOX AUTO-COMPLETE: resolving ${rows.rows.length} pending payment(s)`);

    for (const r of rows.rows) {
      const fakeId = `SANDBOX-AUTO-${Date.now()}-${r.id.slice(0, 8)}`;
      await db.query(
        `UPDATE marketer_properties
         SET payment_status      = 'PAID',
             payment_confirmed_at = NOW(),
             checkout_request_id  = COALESCE(checkout_request_id, $2),
             updated_at           = NOW()
         WHERE id = $1 AND payment_status = 'AWAITING_CONFIRMATION'`,
        [r.id, fakeId]
      );
      await db.query(
        `UPDATE marketer_properties SET status = 'PUBLISHED', updated_at = NOW()
         WHERE id = $1 AND status = 'APPROVED'`,
        [r.id]
      ).catch(() => {});
      // Sync payments table if a row exists
      await db.query(
        `UPDATE payments SET status = 'COMPLETED', updated_at = NOW()
         WHERE property_id = $1 AND status != 'COMPLETED'`,
        [r.id]
      ).catch(() => {});
      logger.info(`[PaymentPoller] SANDBOX AUTO-COMPLETE: property "${r.property_name}" marked PAID`);
    }
  } catch (err: any) {
    logger.error('[PaymentPoller] Auto-complete error', { err: err.message });
  }
}

// ── Real mode: query Safaricom for each pending property ──────────────────────
async function resolveProperty(id: string, checkoutRequestId: string): Promise<void> {
  try {
    const result = await darajaClient.getPaymentStatus(checkoutRequestId);

    if (result.status === 'COMPLETED') {
      await db.query(
        `UPDATE marketer_properties
         SET payment_status       = 'PAID',
             payment_confirmed_at = NOW(),
             -- Apply pending package upgrade if one was queued
             package              = COALESCE(pending_package_upgrade, package),
             placement_tier       = COALESCE(pending_placement_tier_upgrade, placement_tier),
             pending_package_upgrade = NULL,
             updated_at           = NOW()
         WHERE id = $1 AND payment_status != 'PAID'`,
        [id]
      );
      await db.query(
        `UPDATE payments SET status = 'COMPLETED', updated_at = NOW()
         WHERE checkout_request_id = $1 AND status != 'COMPLETED'`,
        [checkoutRequestId]
      ).catch(() => {});
      await db.query(
        `UPDATE marketer_properties SET status = 'PUBLISHED', updated_at = NOW()
         WHERE id = $1 AND status = 'APPROVED'`,
        [id]
      ).catch(() => {});
      logger.info('[PaymentPoller] Property marked PAID', { id, checkoutRequestId });
    } else if (result.status === 'FAILED') {
      await db.query(
        `UPDATE marketer_properties
         SET payment_status = 'FAILED', updated_at = NOW()
         WHERE id = $1 AND payment_status = 'AWAITING_CONFIRMATION'`,
        [id]
      );
      logger.info('[PaymentPoller] Property marked FAILED', { id, checkoutRequestId });
    }
  } catch (err: any) {
    logger.warn('[PaymentPoller] Could not query status', { id, err: err.message });
  }
}

async function pollPendingPayments(): Promise<void> {
  if (sandboxAutoComplete) {
    await autoCompleteAll();
    return;
  }
  try {
    const rows = await db.query(
      `SELECT id, checkout_request_id
       FROM marketer_properties
       WHERE payment_status = 'AWAITING_CONFIRMATION'
         AND checkout_request_id IS NOT NULL
         AND updated_at > NOW() - INTERVAL '15 minutes'
         AND created_at > NOW() - INTERVAL '24 hours'`
    );
    if (!rows.rows.length) return;
    logger.info(`[PaymentPoller] Checking ${rows.rows.length} pending payment(s)`);
    await Promise.allSettled(
      rows.rows.map((r: any) => resolveProperty(r.id, r.checkout_request_id))
    );

    // Expire payments that have been AWAITING_CONFIRMATION for more than 24 hours
    // without a webhook callback — mark them FAILED so they don't loop forever.
    await db.query(
      `UPDATE marketer_properties
       SET payment_status = 'FAILED', updated_at = NOW()
       WHERE payment_status = 'AWAITING_CONFIRMATION'
         AND created_at < NOW() - INTERVAL '24 hours'`
    ).catch((err: any) => logger.error('[PaymentPoller] Failed to expire stale payments', { err: err.message }));
  } catch (err: any) {
    logger.error('[PaymentPoller] Poll cycle error', { err: err.message });
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let isPolling = false; // guard against overlapping poll cycles

async function safePollPendingPayments(): Promise<void> {
  if (isPolling) {
    logger.debug('[PaymentPoller] Previous cycle still running — skipping this tick');
    return;
  }
  isPolling = true;
  try {
    await pollPendingPayments();
  } finally {
    isPolling = false;
  }
}

export function startPaymentPoller(): void {
  if (pollTimer) return;
  logger.info(`[PaymentPoller] Started — mode: ${sandboxAutoComplete ? 'SANDBOX AUTO-COMPLETE' : 'live'}, interval: ${POLL_INTERVAL_MS / 1000}s`);
  // Run immediately on startup to catch any stuck payments
  safePollPendingPayments();
  pollTimer = setInterval(safePollPendingPayments, POLL_INTERVAL_MS);
}

export function stopPaymentPoller(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}
