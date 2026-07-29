/**
 * Credit system — based on Minimax API cost
 *
 * Pricing (approximate, Minimax M3):
 *  - Input:  ~$0.001 / 1K tokens
 *  - Output: ~$0.002 / 1K tokens
 *
 * 1 credit = $0.001 USD
 * So:
 *  - 1K input tokens  ≈ 1 credit
 *  - 1K output tokens ≈ 2 credits
 *
 * Free tier: 100 credits ≈ $0.10 ≈ 5-7 generations
 */

import { generateId } from './crypto';
import type { Bindings } from './types';

export type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

/**
 * Calculate credits used for a generation.
 * Returns ceiling of (input_cost + output_cost) where cost is in $0.001 units.
 */
export function calculateCredits(usage: Usage | undefined, multiplier: number = 1): number {
  if (!usage) return 1; // minimum 1 credit per call
  const inputCost = (usage.prompt_tokens || 0) / 1000 * 1;   // $0.001 = 1 credit
  const outputCost = (usage.completion_tokens || 0) / 1000 * 2; // $0.002 = 2 credits
  return Math.max(1, Math.ceil((inputCost + outputCost) * multiplier));
}

/**
 * Get current credit balance for a user.
 */
export async function getCredits(env: Bindings, userId: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT credits FROM users WHERE id = ?'
  ).bind(userId).first<{ credits: number }>();
  return row?.credits ?? 0;
}

/**
 * Check if user has enough credits.
 */
export async function hasEnoughCredits(
  env: Bindings,
  userId: string,
  required: number
): Promise<{ ok: boolean; balance: number; required: number }> {
  const balance = await getCredits(env, userId);
  return { ok: balance >= required, balance, required };
}

/**
 * Deduct credits from user. Returns the new balance, or null if insufficient.
 */
export async function deductCredits(
  env: Bindings,
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string
): Promise<{ ok: true; balance: number } | { ok: false; error: string; balance: number }> {
  const current = await getCredits(env, userId);
  if (current < amount) {
    return { ok: false, error: 'insufficient_credits', balance: current };
  }

  const newBalance = current - amount;
  const txId = generateId();

  // Atomic update with check
  const result = await env.DB.prepare(
    'UPDATE users SET credits = ?, updated_at = ? WHERE id = ? AND credits >= ?'
  ).bind(newBalance, Date.now(), userId, amount).run();

  if (result.meta.changes === 0) {
    // Race condition: someone else deducted in between
    const recheck = await getCredits(env, userId);
    return { ok: false, error: 'race_condition', balance: recheck };
  }

  await env.DB.prepare(`
    INSERT INTO credit_transactions (id, user_id, delta, reason, reference_id, balance_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(txId, userId, -amount, reason, referenceId || null, newBalance, Date.now()).run();

  return { ok: true, balance: newBalance };
}

/**
 * Add credits to user (admin grant, signup bonus, refund).
 */
export async function addCredits(
  env: Bindings,
  userId: string,
  amount: number,
  reason: string,
  options: { referenceId?: string; note?: string; createdBy?: string } = {}
): Promise<{ ok: true; balance: number } | { ok: false; error: string; balance: number }> {
  const current = await getCredits(env, userId);
  const newBalance = current + amount;
  const txId = generateId();

  await env.DB.prepare(
    'UPDATE users SET credits = ?, updated_at = ? WHERE id = ?'
  ).bind(newBalance, Date.now(), userId).run();

  await env.DB.prepare(`
    INSERT INTO credit_transactions (id, user_id, delta, reason, reference_id, balance_after, note, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    txId,
    userId,
    amount,
    reason,
    options.referenceId || null,
    newBalance,
    options.note || null,
    options.createdBy || null,
    Date.now()
  ).run();

  return { ok: true, balance: newBalance };
}

/**
 * Get credit transaction history for a user.
 */
export async function getCreditHistory(
  env: Bindings,
  userId: string,
  limit = 20
): Promise<any[]> {
  const result = await env.DB.prepare(`
    SELECT id, delta, reason, reference_id, balance_after, note, created_at
    FROM credit_transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(userId, limit).all();
  return result.results || [];
}

/**
 * Get total cost in USD.
 */
export function creditsToUsd(credits: number): number {
  return credits * 0.001;
}
