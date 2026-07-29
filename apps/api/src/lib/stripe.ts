/**
 * Stripe SDK wrapper for Cloudflare Workers
 * 
 * Used for:
 *   - PromptPay QR payments (Thailand)
 *   - Webhook signature verification
 * 
 * Setup:
 *   1. Get test keys at https://dashboard.stripe.com/test/apikeys
 *   2. Set STRIPE_SECRET_KEY in wrangler.toml
 *   3. Set STRIPE_WEBHOOK_SECRET after creating endpoint
 */

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(secretKey?: string): Stripe {
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  if (!_stripe) {
    _stripe = new Stripe(secretKey, {
      // Latest API version for PromptPay support
      apiVersion: '2024-12-18.acacia' as any,
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return _stripe;
}

/**
 * Create a PaymentIntent for PromptPay QR payment.
 * Returns the client_secret + PaymentIntent for frontend to use Stripe.js.
 */
export async function createPromptPayPayment(opts: {
  secretKey: string;
  amountSatang: number;
  packageId: string;
  packageName: string;
  credits: number;
  userId: string;
  userEmail: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe(opts.secretKey);

  return await stripe.paymentIntents.create({
    amount: opts.amountSatang,
    currency: 'thb',
    payment_method_types: ['promptpay'],
    description: `BusinessAiOs ${opts.packageName} — ${opts.credits} credits`,
    receipt_email: opts.userEmail,
    metadata: {
      package_id: opts.packageId,
      credits: String(opts.credits),
      user_id: opts.userId,
      ...(opts.metadata || {}),
    },
  });
}

/**
 * Retrieve a PaymentIntent to check its current status.
 */
export async function getPaymentIntent(secretKey: string, id: string): Promise<Stripe.PaymentIntent> {
  return await getStripe(secretKey).paymentIntents.retrieve(id);
}

/**
 * Verify and parse a Stripe webhook event.
 * Returns the parsed Stripe.Event or throws on invalid signature.
 */
export function verifyWebhook(secretKey: string, signature: string, body: string): Stripe.Event {
  const stripe = getStripe(secretKey);
  // Construct event with signature verification
  return stripe.webhooks.constructEvent(body, signature, secretKey);
}

/**
 * Check if Stripe is configured.
 */
export function isStripeConfigured(env: { STRIPE_SECRET_KEY?: string }): boolean {
  return !!env.STRIPE_SECRET_KEY && env.STRIPE_SECRET_KEY.length > 0;
}
