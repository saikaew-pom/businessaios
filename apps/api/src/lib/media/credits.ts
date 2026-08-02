import { addCredits, deductCredits } from '../credit';
import type { Bindings } from '../types';

export type MediaCreditHoldRow = {
  generation_id: string;
  user_id: string;
  reserved_credits: number;
  final_credits: number | null;
  status: 'reserved' | 'settlement_pending' | 'finalized' | 'refund_pending' | 'refunded';
  reserve_transaction_id: string | null;
  final_transaction_id: string | null;
  refund_transaction_id: string | null;
  expires_at: number;
  settlement_reason: string | null;
  created_at: number;
  updated_at: number;
};

export async function reserveMediaCredits(
  env: Bindings,
  userId: string,
  generationId: string,
  credits: number,
  expiresAt: number,
  now = Date.now(),
) {
  const reserved = await deductCredits(env, userId, credits, 'media_generation_reserve', generationId);
  if (!reserved.ok) return reserved;

  await env.DB.prepare(`
    INSERT INTO media_credit_holds (
      generation_id, user_id, reserved_credits, status, expires_at, created_at, updated_at
    )
    VALUES (?, ?, ?, 'reserved', ?, ?, ?)
    ON CONFLICT(generation_id) DO NOTHING
  `).bind(generationId, userId, credits, expiresAt, now, now).run();

  return { ok: true as const, balance: reserved.balance };
}

export async function finalizeMediaHold(
  env: Bindings,
  generationId: string,
  finalCredits: number,
  reason: string,
  now = Date.now(),
) {
  const hold = await getMediaHold(env, generationId);
  if (!hold) return { ok: false as const, error: 'hold_not_found' };
  if (hold.status === 'finalized') return { ok: true as const, balance: await getUserBalance(env, hold.user_id), idempotent: true };
  if (hold.status === 'refunded') return { ok: false as const, error: 'hold_already_refunded' };

  let balance = await getUserBalance(env, hold.user_id);
  if (finalCredits < hold.reserved_credits) {
    const refund = await addCredits(env, hold.user_id, hold.reserved_credits - finalCredits, 'media_generation_refund', {
      referenceId: generationId,
      note: 'Media generation delivered for fewer credits than reserved',
    });
    if (refund.ok) balance = refund.balance;
  }

  await env.DB.prepare(`
    UPDATE media_credit_holds
    SET status = 'finalized', final_credits = ?, settlement_reason = ?, updated_at = ?
    WHERE generation_id = ? AND status IN ('reserved', 'settlement_pending')
  `).bind(finalCredits, reason, now, generationId).run();

  return { ok: true as const, balance };
}

export async function refundMediaHold(
  env: Bindings,
  generationId: string,
  reason: string,
  now = Date.now(),
) {
  const hold = await getMediaHold(env, generationId);
  if (!hold) return { ok: false as const, error: 'hold_not_found' };
  if (hold.status === 'refunded') return { ok: true as const, balance: await getUserBalance(env, hold.user_id), idempotent: true };
  if (hold.status === 'finalized') return { ok: false as const, error: 'hold_already_finalized' };

  const refund = await addCredits(env, hold.user_id, hold.reserved_credits, 'media_generation_refund', {
    referenceId: generationId,
    note: reason,
  });
  if (!refund.ok) return refund;

  await env.DB.prepare(`
    UPDATE media_credit_holds
    SET status = 'refunded', final_credits = 0, settlement_reason = ?, updated_at = ?
    WHERE generation_id = ? AND status IN ('reserved', 'settlement_pending', 'refund_pending')
  `).bind(reason, now, generationId).run();

  return { ok: true as const, balance: refund.balance };
}

export async function getMediaHold(env: Pick<Bindings, 'DB'>, generationId: string) {
  return env.DB.prepare('SELECT * FROM media_credit_holds WHERE generation_id = ?')
    .bind(generationId).first<MediaCreditHoldRow>();
}

async function getUserBalance(env: Pick<Bindings, 'DB'>, userId: string) {
  const row = await env.DB.prepare('SELECT credits FROM users WHERE id = ?').bind(userId).first<{ credits: number }>();
  return row?.credits ?? 0;
}
