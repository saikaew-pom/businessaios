/**
 * Payment routes — Stripe PromptPay (Thai QR)
 *
 * Endpoints:
 *   GET  /api/payments/packages           — list available credit packages (public)
 *   POST /api/payments/create-intent     — create PaymentIntent for PromptPay
 *   GET  /api/payments/status/:id        — check PaymentIntent status
 *   GET  /api/payments/history           — user's payment history
 *   POST /api/payments/webhook           — Stripe webhook (no auth, signature verified)
 *   POST /api/payments/dev-mock-success  — DEV ONLY: simulate successful payment
 */

import { Hono } from 'hono';
import type { Bindings } from './lib/types';
import { requireAuth, getUser } from './lib/middleware';
import { PACKAGES, getPackage, listPackages, type CreditPackage } from './lib/packages';
import {
  createPromptPayPayment,
  getPaymentIntent,
  verifyWebhook,
  isStripeConfigured,
} from './lib/stripe';
import { addCredits, getCredits } from './lib/credit';
import { generateId } from './lib/crypto';

const payments = new Hono<{ Bindings: Bindings }>();

// =====================================================
// Public: list packages
// =====================================================
payments.get('/api/payments/packages', (c) => {
  return c.json({
    packages: listPackages(),
    signup_bonus: 200,
    currency: 'THB',
  });
});

// =====================================================
// Auth required: create PaymentIntent
// =====================================================
payments.post('/api/payments/create-intent', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ package_id: string }>();
  const pkg = getPackage(body.package_id);
  if (!pkg) return c.json({ error: 'invalid_package' }, 400);

  const env = c.env;

  if (!isStripeConfigured(env)) {
    // Dev fallback: return mock intent
    return c.json({
      mode: 'mock',
      package: pkg,
      payment_intent_id: `pi_mock_${generateId()}`,
      client_secret: `pi_mock_${generateId()}_secret_mock`,
      next_action: {
        type: 'mock_qr',
        qr_data: `MOCK_PROMPTPAY:${pkg.price_satang}:${pkg.id}`,
      },
      message: 'Stripe not configured — using mock mode (test only)',
    });
  }

  try {
    const intent = await createPromptPayPayment({
      secretKey: env.STRIPE_SECRET_KEY!,
      amountSatang: pkg.price_satang,
      packageId: pkg.id,
      packageName: pkg.name,
      credits: pkg.credits,
      userId: user.id,
      userEmail: user.email,
    });

    // Save payment record (status: pending)
    const paymentId = generateId();
    await env.DB.prepare(`
      INSERT INTO payments (id, user_id, package_id, credits, amount_satang, payment_intent_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      paymentId,
      user.id,
      pkg.id,
      pkg.credits,
      pkg.price_satang,
      intent.id,
      Date.now(),
      Date.now()
    ).run();

    return c.json({
      mode: 'live',
      package: pkg,
      payment_intent_id: intent.id,
      client_secret: intent.client_secret,
      next_action: intent.next_action,
    });
  } catch (e: any) {
    console.error('create-intent error:', e);
    return c.json({ error: 'stripe_error', message: e?.message || 'Failed to create payment' }, 500);
  }
});

// =====================================================
// Auth required: check status
// =====================================================
payments.get('/api/payments/status/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');

  // Check our DB first
  const row = await c.env.DB.prepare(
    'SELECT * FROM payments WHERE payment_intent_id = ? AND user_id = ?'
  ).bind(id, user.id).first<any>();

  if (!row) return c.json({ error: 'not_found' }, 404);

  // If already credited, return immediately
  if (row.status === 'succeeded') {
    return c.json({
      status: 'succeeded',
      credits_added: row.credits,
      package_id: row.package_id,
    });
  }

  // Check Stripe if configured
  if (isStripeConfigured(c.env) && !id.startsWith('pi_mock_')) {
    try {
      const intent = await getPaymentIntent(c.env.STRIPE_SECRET_KEY!, id);
      if (intent.status === 'succeeded' && row.status === 'pending') {
        // Webhook hasn't fired yet — credit now
        await creditUserForPayment(c.env, row);
        return c.json({
          status: 'succeeded',
          credits_added: row.credits,
          package_id: row.package_id,
        });
      }
      return c.json({ status: intent.status, payment_intent_status: intent.status });
    } catch (e: any) {
      return c.json({ status: row.status, error: e?.message }, 500);
    }
  }

  return c.json({ status: row.status });
});

// =====================================================
// Auth required: payment history
// =====================================================
payments.get('/api/payments/history', requireAuth, async (c) => {
  const user = c.get('user')!;
  const rows = await c.env.DB.prepare(`
    SELECT id, package_id, credits, amount_satang, status, created_at
    FROM payments WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).bind(user.id).all();
  return c.json({ payments: rows.results || [] });
});

// =====================================================
// Stripe Webhook (no auth — verified by signature)
// =====================================================
payments.post('/api/payments/webhook', async (c) => {
  const env = c.env;
  if (!isStripeConfigured(env)) {
    return c.json({ error: 'stripe_not_configured' }, 503);
  }

  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'missing_signature' }, 400);

  const body = await c.req.text();
  let event;
  try {
    // We use a separate secret for webhook verification
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET || env.STRIPE_SECRET_KEY!;
    event = verifyWebhook(webhookSecret, sig, body);
  } catch (e: any) {
    console.error('Webhook signature failed:', e.message);
    return c.json({ error: 'invalid_signature', message: e.message }, 400);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as any;
    const paymentIntentId = intent.id;
    const row = await env.DB.prepare(
      'SELECT * FROM payments WHERE payment_intent_id = ?'
    ).bind(paymentIntentId).first<any>();

    if (row && row.status === 'pending') {
      await creditUserForPayment(env, row);
      console.log(`✅ Payment ${paymentIntentId} succeeded, credited user ${row.user_id} ${row.credits} credits`);
    } else {
      console.log(`Webhook received but no pending payment found: ${paymentIntentId}`);
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as any;
    await env.DB.prepare(`
      UPDATE payments SET status = 'failed', updated_at = ? WHERE payment_intent_id = ?
    `).bind(Date.now(), intent.id).run();
  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as any;
    const paymentIntentId = charge.payment_intent;
    const row = await env.DB.prepare(
      'SELECT * FROM payments WHERE payment_intent_id = ?'
    ).bind(paymentIntentId).first<any>();

    if (row && row.status === 'succeeded') {
      // Deduct credits (refund)
      const txId = generateId();
      const newBalance = await getCredits(env, row.user_id) - row.credits;
      await env.DB.prepare('UPDATE users SET credits = ?, updated_at = ? WHERE id = ?')
        .bind(newBalance, Date.now(), row.user_id).run();
      await env.DB.prepare(`
        INSERT INTO credit_transactions (id, user_id, delta, reason, reference_id, balance_after, created_at)
        VALUES (?, ?, ?, 'refund', ?, ?, ?)
      `).bind(txId, row.user_id, -row.credits, paymentIntentId, newBalance, Date.now()).run();
      await env.DB.prepare(`
        UPDATE payments SET status = 'refunded', updated_at = ? WHERE payment_intent_id = ?
      `).bind(Date.now(), paymentIntentId).run();
      console.log(`↩️ Refund: ${paymentIntentId}, deducted ${row.credits} credits from ${row.user_id}`);
    }
  }

  return c.json({ received: true });
});

// =====================================================
// DEV ONLY: simulate successful payment (no Stripe)
// =====================================================
payments.post('/api/payments/dev-mock-success', requireAuth, async (c) => {
  const env = c.env;
  if (isStripeConfigured(env)) {
    return c.json({ error: 'not_available_in_live_mode' }, 403);
  }

  const user = c.get('user')!;
  const body = await c.req.json<{ package_id: string }>();
  const pkg = getPackage(body.package_id);
  if (!pkg) return c.json({ error: 'invalid_package' }, 400);

  const paymentId = generateId();
  const paymentIntentId = `pi_mock_${paymentId}`;
  await env.DB.prepare(`
    INSERT INTO payments (id, user_id, package_id, credits, amount_satang, payment_intent_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'succeeded', ?, ?)
  `).bind(
    paymentId, user.id, pkg.id, pkg.credits, pkg.price_satang,
    paymentIntentId, Date.now(), Date.now()
  ).run();

  await addCredits(env, user.id, pkg.credits, 'topup', {
    referenceId: paymentIntentId,
    note: `Mock topup: ${pkg.name}`,
  });

  return c.json({
    success: true,
    credits_added: pkg.credits,
    new_balance: await getCredits(env, user.id),
  });
});

// =====================================================
// Helper: credit user for a successful payment (idempotent)
// =====================================================
async function creditUserForPayment(env: Bindings, row: any) {
  // Update payment status
  await env.DB.prepare(`
    UPDATE payments SET status = 'succeeded', updated_at = ? WHERE id = ?
  `).bind(Date.now(), row.id).run();

  // Add credits (idempotent via referenceId in credit_transactions)
  await addCredits(env, row.user_id, row.credits, 'topup', {
    referenceId: row.payment_intent_id,
    note: `Topup: ${row.package_id}`,
  });
}

export default payments;
